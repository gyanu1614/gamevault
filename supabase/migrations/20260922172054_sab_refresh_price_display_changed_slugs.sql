-- Price-data separation (Step 7c): make the price refresh report WHICH items
-- changed, so revalidation can be per item instead of per game.
--
-- WHY: /api/internal/sab-market-revalidate calls revalidateTag('values:<game>'),
-- which marks EVERY one of that game's ~500 item pages stale on every crawl —
-- 8 crawls a day, whether or not a price moved. The 2026-09-22 build audit
-- measured that at ~120,480 of the ~150,000 monthly stale-marks, i.e. ~80% of
-- the ISR budget, and a stale-marked page costs CPU on its next visit (a values
-- item page is ~5 uncached Supabase round trips).
--
-- Prices are materialized by sab_refresh_price_display(), which does
-- delete-all + insert from sab_public_price_catalog_corrected inside one
-- transaction. The old rows are gone by the time the caller could diff them, so
-- the diff has to happen INSIDE the function, between the delete and the
-- insert. This adds a second function that does exactly that and returns the
-- changed brainrot slugs; the original is left alone so nothing that calls it
-- today changes behaviour.
--
-- WHAT COUNTS AS CHANGED: the four numbers the item page renders
-- (market_value_usd, cheapest_usd, average_usd, market_low/high) plus
-- appearance and disappearance of a row. `is distinct from` so NULL→value and
-- value→NULL both count. refreshed_at/price_updated_at are deliberately NOT
-- compared: they move on every crawl by definition, and comparing them would
-- mark everything changed and rebuild exactly the behaviour being removed.

create or replace function public.sab_refresh_price_display_changed()
returns table (brainrot_slug text)
language plpgsql
security definer
set search_path = public
set statement_timeout = '120s'
as $$
begin
  -- Snapshot the price-bearing columns before they are deleted. Transaction
  -- local: no table to clean up, and it cannot be read by anyone else.
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

  -- Same refresh as sab_refresh_price_display(). The `where brainrot_id is not
  -- null` predicate is required by safe-update mode (ROUTE-013) and is true for
  -- every row — it is a guard-satisfying no-op, not a narrowing filter.
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
    brainrot_id, brainrot_name, brainrot_slug, rarity, image_url,
    mutation_id, mutation_name, mutation_slug,
    market_value_usd, market_low_usd, market_high_usd,
    confidence_label, external_sample_size, source_count,
    price_updated_at, is_trade_ready, is_public_estimate,
    is_anchored, correction_reason, anchor_usd, cohort_size,
    cheapest_usd, average_usd, now()
  from public.sab_public_price_catalog_corrected;

  -- A full outer join catches all three cases: a value that moved, a
  -- (brainrot, mutation) pair that appeared, and one that disappeared. Any
  -- mutation changing marks the whole item page stale, because the page renders
  -- the mutation table.
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

-- Service-role only, like every other function in this chain. The baseline
-- default privileges historically granted EXECUTE to anon/authenticated on new
-- functions (migration 20260913100000 revoked that default), so state it
-- explicitly rather than relying on inheritance.
revoke all on function public.sab_refresh_price_display_changed() from public, anon, authenticated;
grant execute on function public.sab_refresh_price_display_changed() to service_role;
