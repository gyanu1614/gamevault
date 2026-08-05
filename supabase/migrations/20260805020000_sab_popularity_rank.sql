-- Real marketplace popularity for the "Popular" tab.
--
-- Popular used to rank by sample_size (how many listings WE crawled), which just
-- surfaced whatever we scraped most — a wall of Secrets, not what actually
-- sells. Eldorado exposes a genuine popularity ordering (offers API,
-- usePopularItems=true). collect-eldorado-popularity.mjs resolves that ordering
-- to brainrots and writes popularity_rank (1 = most popular; null = not seen in
-- the popular feed, sorts after ranked items).

alter table public.sab_brainrots
  add column if not exists popularity_rank integer;

-- The value page reads popularity_rank directly from sab_brainrots (a small
-- extra query merged into the directory), so the hand-edited
-- sab_brainrot_market_catalog view does NOT need redefining. Index keeps the
-- Popular sort cheap.
create index if not exists sab_brainrots_popularity_rank_idx
  on public.sab_brainrots (popularity_rank)
  where popularity_rank is not null;
