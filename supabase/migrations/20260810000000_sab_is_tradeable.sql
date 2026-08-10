-- ============================================================================
-- Curated crawl set: is_tradeable flag on sab_brainrots
-- ============================================================================
-- Blindly crawling all 498 brainrots wastes budget on junk nobody trades
-- (untraded Mythics/Legendaries/Commons whose listings are fake noise) and
-- slows the re-crawl cycle so much that real items go stale for days.
--
-- This flag marks the ~300 VALUABLE/SELLABLE brainrots the crawl should target.
-- It is recomputed nightly by the correction cron (which holds the service role
-- and runs right after a crawl, so the reputable verdicts it reads are fresh) —
-- see runSabCorrection. The collector (anon key, cannot read corrections) reads
-- ONLY this flag on sab_brainrots, so the curation verdict must live here.
--
-- DEFAULT true: before the first nightly recompute nothing is starved — every
-- item stays crawlable until the cron computes the real set. Safe to re-run.
-- ============================================================================

begin;

alter table public.sab_brainrots
  add column if not exists is_tradeable boolean not null default true;

comment on column public.sab_brainrots.is_tradeable is
  'TRUE = worth crawling (has reputable/trusted sales, or is in Eldorado''s '
  'popular feed). Recomputed nightly by the correction cron. The collector '
  'crawls only is_tradeable=true. Junk (untraded low-rarity, fake listings) '
  'flips to false and drops out of the crawl rotation.';

-- Partial index: the collector filters on is_tradeable=true, so only index those.
create index if not exists sab_brainrots_tradeable_idx
  on public.sab_brainrots (is_tradeable)
  where is_tradeable;

-- ---------------------------------------------------------------------------
-- Recompute function — called by the correction cron as its last step.
-- ---------------------------------------------------------------------------
-- An item is tradeable if ANY of:
--   (a) it has a mutation priced from real sellers (reason reputable/trusted,
--       publishable) — the strongest "people actually sell this" signal;
--   (b) it's in Eldorado's popular feed (popularity_rank present) — rescues
--       genuinely-popular items whose review data is still thin;
-- Rarity is deliberately NOT a signal — high-rarity junk (a $2 Brainrot God)
-- must drop out, and valuable low-rarity items must stay in, so the flag keys
-- on real trading activity, not tier.
create or replace function public.sab_recompute_tradeable()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  changed bigint;
begin
  update public.sab_brainrots b
  set is_tradeable = (
       exists (
         select 1 from public.sab_price_corrections c
         where c.brainrot_id = b.id
           and c.is_publishable
           and c.reason in ('reputable', 'trusted')
       )
    or b.popularity_rank is not null
  )
  -- Postgres safe-update guard rejects an UPDATE with no WHERE; this qualifier
  -- matches every row (id is the PK, never null) so the recompute still touches
  -- the whole table.
  where b.id is not null;
  get diagnostics changed = row_count;
  return changed;
end
$$;

comment on function public.sab_recompute_tradeable() is
  'Recomputes sab_brainrots.is_tradeable from current reputable/trusted '
  'corrections + popularity feed. Called by the correction cron post-crawl so '
  'the flag never drifts stale relative to prices. Returns rows touched.';

commit;
