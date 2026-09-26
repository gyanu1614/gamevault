-- sab_count_unrepriced(): how many priced keys have evidence NEWER than their
-- price. This is the question the stale-row freshness guard actually needs.
--
-- Why: PR #76 (2026-09-19) made the SAB correction write incrementally — a
-- row's computed_at moves only when its listings were re-observed — and, in
-- the same commit, added a guard that alerts when >25 sab_price_display rows
-- carry a price_updated_at older than 6h. price_updated_at IS
-- sab_price_corrections.computed_at (sab_public_price_catalog_corrected), so
-- every item the crawl did not visit in the last 6h was "stale" by
-- construction. The guard failed on every run (1584 rows at 03:02Z, 688 at
-- 22:56Z on 2026-09-20) and emailed every three hours, while the reprice step
-- it was meant to watch was green.
--
-- Row AGE cannot tell "not crawled" from "crawled but not repriced". The
-- partial freeze the guard exists to catch — the 2026-09-14 outage, where
-- correct-prices 504'd and 214 brainrots served five-day-old prices — is the
-- second shape: the crawl kept landing new listings and the price did not
-- follow. That is evidence newer than price, per key, and it is what this
-- function counts. Right after a successful reprice it is 0 by definition:
-- every key whose listings moved was rewritten with computed_at = run start.
--
-- Only active + matched listings count as evidence, because those are the
-- only rows the correction reads (runSabCorrection, src/lib/pricing/games/
-- sab.ts): a re-observed ended or unmatched listing must not make a price
-- look behind. Only keys that HAVE a correction are counted: a key with
-- listings but no correction row (filtered out of the catalog view) is a
-- different question and would otherwise read as "unrepriced" forever.
--
-- p_grace_seconds excludes observations newer than the grace, so the daily
-- Vercel cron landing mid-crawl (listings just imported, reprice not yet run)
-- is not a false positive. The in-job check, which runs AFTER the reprice,
-- passes 0.
--
-- Uses the partial index (brainrot_id, mutation_id, observed_at desc) WHERE
-- parse_status = 'matched' for the per-key max; ~34k active matched rows.

create or replace function public.sab_count_unrepriced(
  p_grace_seconds integer default 3600
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  with newest as (
    select
      brainrot_id,
      mutation_id,
      max(observed_at) as observed_at
    from public.sab_market_raw_listings
    where listing_status = 'active'
      and parse_status = 'matched'
      and observed_at is not null
      and brainrot_id is not null
      and mutation_id is not null
    group by brainrot_id, mutation_id
  )
  select count(*)
  from newest n
  join public.sab_price_corrections c
    on c.brainrot_id = n.brainrot_id
   and c.mutation_id = n.mutation_id
  where n.observed_at < now() - make_interval(secs => coalesce(p_grace_seconds, 0))
    and (c.computed_at is null or n.observed_at > c.computed_at);
$$;

comment on function public.sab_count_unrepriced(integer) is
  'Priced (brainrot, mutation) keys whose newest active matched listing is newer than their correction''s computed_at, ignoring observations younger than p_grace_seconds. 0 right after a successful reprice.';

-- Service-role only: the freshness cron and the runner call it through
-- createServiceRoleClient(). Migration 20260913100000 already revokes the
-- default grant on new functions, but be explicit — this reads raw listings.
revoke all on function public.sab_count_unrepriced(integer) from public, anon, authenticated;
grant execute on function public.sab_count_unrepriced(integer) to service_role;
