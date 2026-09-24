-- sab_refresh_price_display_changed() (migration 20260922172054, PR #89) has
-- never run successfully: its INSERT … SELECT names the catalogue columns
-- unqualified, and `brainrot_slug` is ALSO the function's OUT column
-- (RETURNS TABLE (brainrot_slug text)). plpgsql resolves an unqualified
-- name against its variables first and, with the default
-- plpgsql.variable_conflict = error, raises
--   column reference "brainrot_slug" is ambiguous
-- on the very first call. Caught 2026-09-23 by the first integration test
-- that drove the function (src/test/routes/sab-refresh-display-changed
-- .integration.test.ts); the original shipped with a static SQL-text test
-- only. Once the edge function starts calling this RPC every publish would
-- have failed and no price would have reached a page.
--
-- Fix: same body, every column qualified with the source alias `c`. The
-- `where brainrot_id is not null` predicate on the DELETE keeps its
-- safe-update-mode idiom (ROUTE-013); that reference is unambiguous
-- (no variable of that name). Idempotent: CREATE OR REPLACE.

create or replace function public.sab_refresh_price_display_changed()
returns table (brainrot_slug text)
language plpgsql
security definer
set search_path = public
set statement_timeout = '120s'
as $$
begin
  create temporary table _sab_price_before on commit drop as
  select
    d.brainrot_slug,
    d.mutation_slug,
    d.market_value_usd,
    d.market_low_usd,
    d.market_high_usd,
    d.cheapest_usd,
    d.average_usd
  from public.sab_price_display d;

  delete from public.sab_price_display
  where brainrot_id is not null;

  insert into public.sab_price_display (
    brainrot_id, brainrot_name, brainrot_slug, rarity, image_url,
    mutation_id, mutation_name, mutation_slug,
    market_value_usd, market_low_usd, market_high_usd,
    confidence_label, external_sample_size, source_count,
    price_updated_at, is_trade_ready, is_public_estimate,
    is_anchored, correction_reason, anchor_usd, cohort_size,
    cheapest_usd, average_usd, refreshed_at
  )
  select
    c.brainrot_id, c.brainrot_name, c.brainrot_slug, c.rarity, c.image_url,
    c.mutation_id, c.mutation_name, c.mutation_slug,
    c.market_value_usd, c.market_low_usd, c.market_high_usd,
    c.confidence_label, c.external_sample_size, c.source_count,
    c.price_updated_at, c.is_trade_ready, c.is_public_estimate,
    c.is_anchored, c.correction_reason, c.anchor_usd, c.cohort_size,
    c.cheapest_usd, c.average_usd, now()
  from public.sab_public_price_catalog_corrected c;

  return query
  select distinct coalesce(a.brainrot_slug, b.brainrot_slug)::text
  from public.sab_price_display a
  full outer join _sab_price_before b
    on  a.brainrot_slug = b.brainrot_slug
    and a.mutation_slug = b.mutation_slug
  where
       a.brainrot_slug is null
    or b.brainrot_slug is null
    or a.market_value_usd is distinct from b.market_value_usd
    or a.market_low_usd   is distinct from b.market_low_usd
    or a.market_high_usd  is distinct from b.market_high_usd
    or a.cheapest_usd     is distinct from b.cheapest_usd
    or a.average_usd      is distinct from b.average_usd;
end;
$$;

comment on function public.sab_refresh_price_display_changed() is
  'Refreshes sab_price_display (same as sab_refresh_price_display) and returns the brainrot_slugs whose published prices actually changed, so revalidation can be per item instead of per game.';

revoke all on function public.sab_refresh_price_display_changed() from public, anon, authenticated;
grant execute on function public.sab_refresh_price_display_changed() to service_role;
