-- T1 (2026-10-04): the LAST PUBLISHED price per value item, for every game.
--
-- Every value game's pricing run (SAB, Adopt Me, Steal an Egg, and the next
-- ones) now revalidates only the item pages whose price moved past a
-- threshold (src/lib/pricing/change-rule.ts: |Δ| > max(3%, $0.05)). "Moved"
-- must be measured against what the pages were last told — not against the
-- previous run — or a slow drift (+2% a day) would never publish. The game
-- tables cannot hold that baseline: sab_price_display is rebuilt from a view
-- on every import, and the Adopt Me / Steal an Egg tables store every
-- sub-threshold move on purpose.
--
-- One generic table, keyed by page slugs, so game #4..#10 need no schema:
--   game_slug  /<game_slug>/values/<item_slug>
--   variant    Adopt Me form, SAB mutation slug, or 'default'
--   prices     the numbers the page shows ({"average": 60.5, "cheapest": 55})
--
-- Written ONLY by the runner (service role) after a successful revalidation
-- (src/lib/pricing/publish.ts). Pages never read it. Until this migration is
-- applied the runner falls back to the old whole-game refresh, so the code may
-- ship first.
--
-- Additive: one new table, no change to existing objects.

create table if not exists public.values_published_prices (
  game_slug    text        not null,
  item_slug    text        not null,
  variant      text        not null,
  prices       jsonb       not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  primary key (game_slug, item_slug, variant)
);

comment on table public.values_published_prices is
  'Last price published to each value item page (T1 changed-only revalidation). Service role only; written by the pricing runner after a successful revalidation.';

-- Service-role only (DLT-005/006 table posture): RLS on, no policy, and the
-- default anon/authenticated grants revoked.
alter table public.values_published_prices enable row level security;
revoke all on table public.values_published_prices from anon, authenticated;
