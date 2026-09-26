-- sab_end_listings(uuid[]): mark a batch of raw listings ended, in ONE
-- statement, with ended_at taken from each row's own fetched_at.
--
-- Why: /api/cron/expire-sab-listings issued one UPDATE per distinct ended_at.
-- ended_at is the listing's own fetched_at — the last moment we saw it, which
-- is the timestamp any survival analysis needs — and fetched_at has
-- millisecond precision, so "per distinct ended_at" was one round-trip per
-- listing: thousands per run. The route ran 96–265s when it finished and was
-- killed at Vercel's 300s function budget in 3 of 8 runs on 2026-09-19/20
-- ("fetch failed" at exactly 301s from the collector). PR #76 made a failed
-- post-crawl trigger fatal to the collect step — correctly — so each of those
-- runs also skipped its reprice.
--
-- The expire job now runs on the GH Actions runner (scripts/expire-listings.mjs)
-- and writes through this function: at most one call per 1000 ids, and the
-- per-row timestamp is resolved server-side where it costs nothing.
--
-- Safe to replay: only rows that are STILL active are touched, so a batch
-- retried after a transient failure — or one that overlaps an import that
-- just refreshed a listing — ends only what the crawl actually missed. The
-- WHERE also satisfies safe-update mode (ROUTE-013). sab_sync_ended_at
-- leaves a non-null ended_at alone on the 'ended' transition.

create or replace function public.sab_end_listings(p_ids uuid[])
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  ended bigint;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;

  update public.sab_market_raw_listings
  set listing_status = 'ended',
      ended_at = fetched_at,
      updated_at = now()
  where id = any(p_ids)
    and listing_status = 'active';

  get diagnostics ended = row_count;
  return ended;
end;
$$;

comment on function public.sab_end_listings(uuid[]) is
  'Marks the given raw listings ended (ended_at = their own fetched_at). Only still-active rows are touched, so a batch is safe to replay.';

-- Service-role only: the runner and the thin manual route both call it through
-- createServiceRoleClient(). Migration 20260913100000 revokes the default
-- grant on new functions; stated explicitly because this writes listing state.
revoke all on function public.sab_end_listings(uuid[]) from public, anon, authenticated;
grant execute on function public.sab_end_listings(uuid[]) to service_role;
