-- SAB raw import: store a slim payload, never re-parse an unchanged title.
--
-- Why (2026-10-20 usage audit, B1/C3; live DB 793 MB on a 500 MB plan):
--   * sab_market_raw_listings was 310 MB. raw_payload held the WHOLE collected
--     item (every typed column again, plus seller fields, signals, collector
--     version), rewritten on every crawl. Only 4 keys are ever read:
--     src/lib/pricing/games/sab.ts (title, seller_sales_count,
--     is_canonical_band, income_band.upper) and two owner audit scripts.
--   * The upsert fired the title parser twice per re-observed listing: the
--     BEFORE INSERT trigger runs on the INSERT attempt of every
--     INSERT ... ON CONFLICT, and the UPDATE OF title trigger runs because the
--     conflict branch assigns title. The parser does ~5 unindexed LIKE scans
--     over the alias tables per call.
--
-- Now:
--   1. sab_slim_raw_payload(jsonb) keeps the 4 read keys.
--   2. The import UPDATEs a listing it already has (no INSERT attempt, so no
--      insert trigger) and INSERTs only new ones (ON CONFLICT kept for races).
--   3. The parse trigger is split: always on INSERT; on UPDATE only when the
--      title really changed, or when sab_reparse_market_listings asks for it
--      (transaction-local app.sab_force_reparse = 'on').
-- Signature, return shape, counters and per-row error capture are unchanged.

-- ── 1. The slim payload ─────────────────────────────────────────────────────
create or replace function public.sab_slim_raw_payload(p_item jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case
    when p_item is null then null
    else jsonb_strip_nulls(jsonb_build_object(
      'title',              p_item -> 'title',
      'seller_sales_count', p_item -> 'seller_sales_count',
      'is_canonical_band',  p_item -> 'is_canonical_band',
      'income_band',        case when p_item ? 'income_band'
                                 then jsonb_strip_nulls(jsonb_build_object('upper', p_item -> 'income_band' -> 'upper'))
                            end
    ))
  end
$$;
comment on function public.sab_slim_raw_payload(jsonb) is
  'The raw_payload keys anything reads (title, seller_sales_count, is_canonical_band, income_band.upper). Used by sab_import_market_listings.';
revoke all on function public.sab_slim_raw_payload(jsonb) from public, anon, authenticated;
grant execute on function public.sab_slim_raw_payload(jsonb) to service_role;

-- ── 2. Parse trigger: insert always, update only on a real title change ─────
drop trigger if exists sab_parse_raw_listing_before_write on public.sab_market_raw_listings;

create trigger sab_parse_raw_listing_before_insert
  before insert on public.sab_market_raw_listings
  for each row execute function public.sab_parse_raw_listing_trigger();

create trigger sab_parse_raw_listing_before_title_change
  before update of title on public.sab_market_raw_listings
  for each row
  when (
    old.title is distinct from new.title
    or current_setting('app.sab_force_reparse', true) = 'on'
  )
  execute function public.sab_parse_raw_listing_trigger();

-- ── 3. Reparse still forces the parser (it assigns title = title) ───────────
create or replace function public.sab_reparse_market_listings(p_limit integer default 500)
returns table(processed_count bigint, matched_count bigint, rejected_count bigint, ambiguous_count bigint, unmatched_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Transaction-local: lets the title-change trigger fire on title = title.
  perform set_config('app.sab_force_reparse', 'on', true);

  return query
  with targets as (
    select listing.id
    from public.sab_market_raw_listings listing
    order by listing.fetched_at desc
    limit greatest(1, least(coalesce(p_limit, 500), 5000))
  ),
  reparsed as (
    update public.sab_market_raw_listings listing
    set title = listing.title
    where listing.id in (select target.id from targets target)
    returning listing.parse_status
  )
  select
    count(*)::bigint,
    count(*) filter (where parse_status = 'matched')::bigint,
    count(*) filter (where parse_status = 'rejected')::bigint,
    count(*) filter (where parse_status = 'ambiguous')::bigint,
    count(*) filter (where parse_status = 'unmatched')::bigint
  from reparsed;
end;
$$;

-- ── 4. The import ───────────────────────────────────────────────────────────
create or replace function public.sab_import_market_listings(p_source_slug text, p_listings jsonb)
returns table(import_run_id uuid, source_slug text, records_seen integer, records_inserted integer, records_updated integer, records_flagged integer, error_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_id uuid;
  v_source_name text;
  v_run_id uuid;

  v_item jsonb;
  v_external_listing_id text;
  v_title text;
  v_listing_url text;
  v_listing_type text;
  v_listing_status text;
  v_currency text;

  v_listed_price numeric;
  v_shipping_price numeric;
  v_total_price_usd numeric;
  v_quantity integer;

  v_observed_at timestamptz;
  v_existing boolean;
  v_parse_status text;

  v_seen integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_flagged integer := 0;
  v_error_count integer := 0;

  v_errors jsonb := '[]'::jsonb;
begin
  if p_listings is null or jsonb_typeof(p_listings) <> 'array' then
    raise exception 'p_listings must be a JSON array';
  end if;

  select source.id, source.name
  into v_source_id, v_source_name
  from public.sab_market_sources source
  where source.slug = lower(trim(p_source_slug))
  limit 1;

  if v_source_id is null then
    raise exception 'Unknown marketplace source: %', p_source_slug;
  end if;

  insert into public.sab_import_runs (source_name, status, details)
  values (
    v_source_name,
    'running',
    jsonb_build_object(
      'source_slug', lower(trim(p_source_slug)),
      'requested_count', jsonb_array_length(p_listings),
      'import_type', 'market_listing_json'
    )
  )
  returning id into v_run_id;

  begin
    for v_item in select value from jsonb_array_elements(p_listings)
    loop
      v_seen := v_seen + 1;

      begin
        v_external_listing_id := nullif(trim(v_item ->> 'external_listing_id'), '');
        v_title := nullif(trim(v_item ->> 'title'), '');
        v_listing_url := nullif(trim(v_item ->> 'listing_url'), '');

        if v_external_listing_id is null then
          raise exception 'external_listing_id is required';
        end if;
        if v_title is null then
          raise exception 'title is required';
        end if;

        v_listing_type := coalesce(nullif(trim(v_item ->> 'listing_type'), ''), 'active_listing');
        v_listing_status := coalesce(
          nullif(trim(v_item ->> 'listing_status'), ''),
          case when v_listing_type = 'completed_sale' then 'sold' else 'active' end
        );
        v_currency := upper(coalesce(nullif(trim(v_item ->> 'currency'), ''), 'USD'));
        v_listed_price := nullif(trim(v_item ->> 'listed_price'), '')::numeric;
        v_shipping_price := coalesce(nullif(trim(v_item ->> 'shipping_price'), '')::numeric, 0);
        v_quantity := greatest(1, coalesce(nullif(trim(v_item ->> 'quantity'), '')::integer, 1));
        v_total_price_usd := coalesce(
          nullif(trim(v_item ->> 'total_price_usd'), '')::numeric,
          coalesce(v_listed_price, 0) + coalesce(v_shipping_price, 0)
        );

        if v_total_price_usd <= 0 then
          raise exception 'total_price_usd must be greater than zero';
        end if;

        v_observed_at := coalesce(nullif(trim(v_item ->> 'observed_at'), '')::timestamptz, now());

        select exists (
          select 1
          from public.sab_market_raw_listings listing
          where listing.source_id = v_source_id
            and listing.external_listing_id = v_external_listing_id
        )
        into v_existing;

        -- A listing we already have: a plain UPDATE (no INSERT attempt, so the
        -- insert-time parser does not run; the title trigger runs only if the
        -- title changed).
        if v_existing then
          update public.sab_market_raw_listings listing
          set
            listing_url = v_listing_url,
            listing_type = v_listing_type,
            listing_status = v_listing_status,
            title = v_title,
            currency = v_currency,
            listed_price = v_listed_price,
            shipping_price = v_shipping_price,
            quantity = v_quantity,
            total_price_usd = v_total_price_usd,
            observed_at = v_observed_at,
            fetched_at = now(),
            raw_payload = public.sab_slim_raw_payload(v_item),
            updated_at = now()
          where listing.source_id = v_source_id
            and listing.external_listing_id = v_external_listing_id
          returning listing.parse_status
          into v_parse_status;

          -- Removed between the lookup and the update (retention): insert it.
          if not found then
            v_existing := false;
          end if;
        end if;

        if not v_existing then
          insert into public.sab_market_raw_listings (
            source_id, external_listing_id, listing_url,
            listing_type, listing_status,
            title,
            currency, listed_price, shipping_price, quantity, total_price_usd,
            observed_at, fetched_at,
            raw_payload
          )
          values (
            v_source_id, v_external_listing_id, v_listing_url,
            v_listing_type, v_listing_status,
            v_title,
            v_currency, v_listed_price, v_shipping_price, v_quantity, v_total_price_usd,
            v_observed_at, now(),
            public.sab_slim_raw_payload(v_item)
          )
          -- A concurrent import inserted it first: same columns as the UPDATE.
          on conflict (source_id, external_listing_id)
          do update set
            listing_url = excluded.listing_url,
            listing_type = excluded.listing_type,
            listing_status = excluded.listing_status,
            title = excluded.title,
            currency = excluded.currency,
            listed_price = excluded.listed_price,
            shipping_price = excluded.shipping_price,
            quantity = excluded.quantity,
            total_price_usd = excluded.total_price_usd,
            observed_at = excluded.observed_at,
            fetched_at = now(),
            raw_payload = excluded.raw_payload,
            updated_at = now()
          returning parse_status
          into v_parse_status;
        end if;

        if v_existing then
          v_updated := v_updated + 1;
        else
          v_inserted := v_inserted + 1;
        end if;

        if coalesce(v_parse_status, 'unmatched') <> 'matched' then
          v_flagged := v_flagged + 1;
        end if;

      exception
        when others then
          v_error_count := v_error_count + 1;
          v_flagged := v_flagged + 1;
          v_errors := v_errors || jsonb_build_array(
            jsonb_build_object(
              'row_number', v_seen,
              'external_listing_id', v_item ->> 'external_listing_id',
              'error', sqlerrm
            )
          );
      end;
    end loop;

    update public.sab_import_runs
    set
      status = 'completed',
      pages_seen = 1,
      records_inserted = v_inserted,
      records_updated = v_updated,
      records_flagged = v_flagged,
      details = details || jsonb_build_object('records_seen', v_seen, 'error_count', v_error_count, 'errors', v_errors),
      completed_at = now()
    where id = v_run_id;

  exception
    when others then
      update public.sab_import_runs
      set
        status = 'failed',
        error_message = sqlerrm,
        details = details || jsonb_build_object('records_seen', v_seen, 'error_count', v_error_count, 'errors', v_errors),
        completed_at = now()
      where id = v_run_id;
      raise;
  end;

  return query
  select v_run_id, lower(trim(p_source_slug)), v_seen, v_inserted, v_updated, v_flagged, v_error_count;
end;
$$;

-- create or replace keeps the existing ACL (service role only, migration
-- 20260913100000); restated so this file stands on its own.
revoke all on function public.sab_import_market_listings(text, jsonb) from public, anon, authenticated;
grant execute on function public.sab_import_market_listings(text, jsonb) to service_role;
revoke all on function public.sab_reparse_market_listings(integer) from public, anon, authenticated;
grant execute on function public.sab_reparse_market_listings(integer) to service_role;
