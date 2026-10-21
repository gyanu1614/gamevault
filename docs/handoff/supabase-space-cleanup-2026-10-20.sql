-- Supabase space cleanup, 2026-10-20 (plan Phase 0)
-- DB was 793 MB on a 500 MB plan. Expected after this: about 380-450 MB.
--
-- HOW TO RUN (Supabase dashboard > SQL Editor):
--   * Run ONE block at a time: select the block, press Run, wait for it to finish.
--   * The VACUUM FULL lines must each be run ALONE (VACUUM refuses to run
--     together with other statements).
--   * Run it when the daily pricing job is NOT running (GitHub Actions >
--     "Values pricing daily" shows no run in progress). Payments, orders and
--     the website are not affected; only the raw price tables are locked for
--     a minute while each VACUUM FULL runs.
--
-- WHY IT IS SAFE: nothing reads these rows any more (checked in code).
--   * values_raw_listings: the pricing job reads only is_active = true rows
--     from the last crawl window (src/lib/pricing/games/values-pipeline.ts).
--   * adopt_me_market_raw_listings: the reprice reads only listing_status =
--     'active' (src/lib/pricing/games/adopt-me.ts).
--   * sab_market_raw_listings.raw_payload: only 4 keys are ever read
--     (src/lib/pricing/games/sab.ts:384-387 and two owner audit scripts).
--   * No other table references these rows (no foreign keys).

-- ── Block 1: preview (read only) ────────────────────────────────────────────
select
  pg_size_pretty(pg_database_size(current_database())) as db_size_now,
  (select count(*) from public.values_raw_listings
     where is_active = false and observed_at < now() - interval '3 days') as values_rows_to_delete,
  (select count(*) from public.values_raw_listings) as values_rows_total,
  (select count(*) from public.adopt_me_market_raw_listings
     where listing_status = 'ended'
       and coalesce(ended_at, collected_at) < now() - interval '7 days') as adopt_me_rows_to_delete,
  (select count(*) from public.adopt_me_market_raw_listings) as adopt_me_rows_total,
  (select count(*) from public.sab_market_raw_listings
     where raw_payload is not null
       and (select count(*) from jsonb_object_keys(raw_payload)) > 4) as sab_rows_to_slim;

-- ── Block 2: delete old MM2 / Steal an Egg raw copies ───────────────────────
set statement_timeout = '15min';
delete from public.values_raw_listings
where is_active = false
  and observed_at < now() - interval '3 days';

-- ── Block 3: delete Adopt Me listings that ended more than 7 days ago ───────
set statement_timeout = '15min';
delete from public.adopt_me_market_raw_listings
where listing_status = 'ended'
  and coalesce(ended_at, collected_at) < now() - interval '7 days';

-- ── Block 4: keep only the 4 payload keys anything reads (SAB) ──────────────
set statement_timeout = '15min';
update public.sab_market_raw_listings
set raw_payload = jsonb_strip_nulls(jsonb_build_object(
      'title',              raw_payload -> 'title',
      'seller_sales_count', raw_payload -> 'seller_sales_count',
      'is_canonical_band',  raw_payload -> 'is_canonical_band',
      'income_band',        case when raw_payload ? 'income_band'
                                 then jsonb_strip_nulls(jsonb_build_object('upper', raw_payload -> 'income_band' -> 'upper'))
                            end))
where raw_payload is not null
  and (select count(*) from jsonb_object_keys(raw_payload)) > 4;

-- ── Block 5: give the space back (run EACH line ALONE, one after another) ───
vacuum full public.values_raw_listings;
vacuum full public.adopt_me_market_raw_listings;
vacuum full public.sab_market_raw_listings;

-- ── Block 6: check the result (read only) ───────────────────────────────────
select
  pg_size_pretty(pg_database_size(current_database())) as db_size_after,
  pg_size_pretty(pg_total_relation_size('public.sab_market_raw_listings'))      as sab_raw,
  pg_size_pretty(pg_total_relation_size('public.values_raw_listings'))          as values_raw,
  pg_size_pretty(pg_total_relation_size('public.adopt_me_market_raw_listings')) as adopt_me_raw,
  pg_size_pretty(pg_total_relation_size('public.sab_price_history'))            as sab_history;
