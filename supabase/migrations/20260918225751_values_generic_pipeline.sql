-- Phase 1 · Step 3 (PR 2) — generic values pipeline + Steal An Egg.
--
-- SAB's values pipeline is 25 tables and 13 views, all prefixed `sab_`; Adopt
-- Me is 4 tables prefixed `adopt_me_`. Games are separated by TABLE NAME, so a
-- third game meant a third schema — and Adopt Me already shows what that
-- produces: a thinner, weaker second copy.
--
-- This adds the game-keyed shape those two will migrate onto in Phase 2
-- (rename + compat view, never a copying sync that can drift). Steal An Egg is
-- the first game to use it, so the shape is proven by a real game before any
-- live data is moved. NOTHING here touches sab_* or adopt_me_*.
--
-- Phase 2 mapping (stated in the Step 3 plan, built later):
--   sab_brainrots                         -> values_items (kind='item')
--   sab_mutations / sab_brainrot_variants -> values_item_variants
--   sab_*_aliases                         -> values_item_aliases
--   sab_market_raw_listings               -> values_raw_listings
--   sab_price_display / *_catalog_corrected -> values_prices
--   sab_price_history / sab_price_snapshots -> values_price_history
--   sab_market_sources / _sync_config / _watchlist -> values_games.config
--   sab_market_rejection_patterns         -> values_rejection_patterns
--
-- Grants: per the 20260913100000 posture, functions/tables here are
-- service-role by default; the anon key gets SELECT only on the rows the
-- public pages read (and only via RLS policies below).

-- ── 1. values_games — the per-game config the whole pipeline is keyed by ────
create table if not exists public.values_games (
  id                uuid primary key default gen_random_uuid(),
  game_id           uuid not null references public.games(id) on delete cascade,
  -- Crawl sources + their per-game search terms, e.g.
  --   [{"source":"eldorado","game_ref":"452","enabled":true}]
  -- A slot per source so adding Itemku/G2G later is a config row edit, not a
  -- schema change (G2G has no Steal An Egg category as of 2026-09-18).
  sources           jsonb  not null default '[]'::jsonb,
  -- Where the item taxonomy comes from, e.g.
  --   {"kind":"fandom","wiki":"stealanegg","categories":["Pets"]}
  taxonomy_source   jsonb  not null default '{}'::jsonb,
  -- Listing-title parser strategy key -> src/lib/values/normalisers/<key>.ts
  normaliser_key    text   not null,
  -- Crawl cadence in minutes (180 = the 3h cadence SAB's Eldorado crawl uses).
  refresh_minutes   integer not null default 180,
  is_enabled        boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint values_games_game_id_key unique (game_id),
  constraint values_games_refresh_minutes_check
    check (refresh_minutes between 15 and 10080)
);

comment on table public.values_games is
  'Per-game values-pipeline config. The Roblox universe id is NOT stored here: '
  'it lives in game_external_ids (platform=roblox), added by Step 2.';

-- ── 2. values_items — every priceable or catalogue item, keyed by game ──────
--
-- `kind` is the column the shared page components branch on, so it is a real
-- CHECK-constrained column and never JSON (same rule as game_categories.type).
--   egg   — a sealed egg: what the Steal An Egg market actually sells
--   area  — a biome/area: the unit eggs are priced by (76% of listings)
--   pet   — hatched pet: CATALOGUE ONLY for Steal An Egg (1.5% of listings
--           name one, so there is no listing evidence to price them)
--   item  — a generic tradable (what sab_brainrots becomes in Phase 2)
--   account_bracket — an account income band (35% of SAE listings are accounts)
create table if not exists public.values_items (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid not null references public.games(id) on delete cascade,
  kind           text not null,
  slug           text not null,
  name           text not null,
  rarity         text,
  -- Area/biome this item belongs to (pets and eggs both have one).
  area           text,
  -- Income per second where the game has one (SAB, Steal An Egg).
  income_per_sec numeric(20, 4),
  -- For a pet: the egg it hatches from. Drives the "buy its source egg"
  -- module on unpriced pet pages.
  source_item_id uuid references public.values_items(id) on delete set null,
  image_url      text,
  -- FALSE = catalogue page, rendered with "no market price yet" copy and
  -- never given an invented price.
  is_priced      boolean not null default false,
  -- Bracket bounds for kind='account_bracket' (income per second).
  bracket_min    numeric(20, 4),
  bracket_max    numeric(20, 4),
  sort_order     integer not null default 0,
  is_enabled     boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint values_items_kind_check
    check (kind in ('egg', 'area', 'pet', 'item', 'account_bracket')),
  constraint values_items_game_slug_key unique (game_id, slug),
  constraint values_items_bracket_bounds_check
    check (
      kind <> 'account_bracket'
      or (bracket_min is not null and (bracket_max is null or bracket_max > bracket_min))
    )
);

create index if not exists values_items_game_kind_idx
  on public.values_items (game_id, kind) where is_enabled;
create index if not exists values_items_source_item_idx
  on public.values_items (source_item_id) where source_item_id is not null;

-- ── 3. values_item_aliases — the mechanism that makes messy titles parse ────
-- Ported from sab_brainrot_aliases/sab_mutation_aliases, which are the reason
-- SAB's title matching works. Steal An Egg needs it on day one: listings say
-- "King Monkey" (an area absent from the wiki's 17 biomes), "Randum", "Ramdom".
create table if not exists public.values_item_aliases (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.values_items(id) on delete cascade,
  alias      text not null,
  created_at timestamptz not null default now(),
  constraint values_item_aliases_item_alias_key unique (item_id, alias)
);
create index if not exists values_item_aliases_alias_idx
  on public.values_item_aliases (lower(alias));

-- ── 4. values_rejection_patterns — titles that must never match ─────────────
-- SAE's unmatched 20% is mostly NOT eggs: "x2 Money" gamepasses, "EGG RUN"
-- services, "SECRET EGGS SERVICE". Rejecting them explicitly keeps them out of
-- the review file's signal.
create table if not exists public.values_rejection_patterns (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  pattern    text not null,
  reason     text,
  created_at timestamptz not null default now(),
  constraint values_rejection_patterns_game_pattern_key unique (game_id, pattern)
);

-- ── 5. values_raw_listings — raw snapshots, nothing dropped silently ────────
create table if not exists public.values_raw_listings (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references public.games(id) on delete cascade,
  source          text not null,
  source_offer_id text not null,
  title           text not null,
  price_usd       numeric(12, 2),
  quantity        integer not null default 1,
  -- Seller review count — the reputable model's second required input. A
  -- listing without it is priced by nothing and is dropped by the adapter.
  seller_reviews  integer,
  -- Parse outcome. 'unmatched' rows are KEPT (they are the review file), never
  -- silently discarded.
  parse_status    text not null default 'unmatched',
  matched_item_id uuid references public.values_items(id) on delete set null,
  -- 0..1 — how confident the title parser is in matched_item_id.
  match_confidence numeric(4, 3),
  is_active       boolean not null default true,
  observed_at     timestamptz not null default now(),
  constraint values_raw_listings_parse_status_check
    check (parse_status in ('matched', 'unmatched', 'rejected', 'ambiguous')),
  constraint values_raw_listings_confidence_check
    check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)),
  constraint values_raw_listings_source_offer_key unique (source, source_offer_id, observed_at)
);

create index if not exists values_raw_listings_game_active_idx
  on public.values_raw_listings (game_id, is_active, observed_at desc);
create index if not exists values_raw_listings_matched_idx
  on public.values_raw_listings (matched_item_id) where matched_item_id is not null;
create index if not exists values_raw_listings_review_idx
  on public.values_raw_listings (game_id, parse_status) where parse_status <> 'matched';

-- ── 6. values_prices — the published value per item ─────────────────────────
create table if not exists public.values_prices (
  item_id          uuid primary key references public.values_items(id) on delete cascade,
  game_id          uuid not null references public.games(id) on delete cascade,
  -- The buyer-facing pair from the shared reputable model (reputable-adapter):
  -- cheapest = lowest reputable listing; average = typical reputable price.
  cheapest_usd     numeric(12, 2),
  average_usd      numeric(12, 2),
  -- Low/high of the real listings behind the value — the trust signal.
  market_low_usd   numeric(12, 2),
  market_high_usd  numeric(12, 2),
  sample_size      integer not null default 0,
  source_count     integer not null default 0,
  confidence_label text,
  -- Drives `lastmod`/`dateModified`: when the VALUE last moved, not when the
  -- crawl last ran. A crawl that changes nothing must not re-date the page.
  price_changed_at timestamptz,
  updated_at       timestamptz not null default now(),
  constraint values_prices_sample_size_check check (sample_size >= 0)
);

create index if not exists values_prices_game_idx on public.values_prices (game_id);

-- ── 7. values_price_history — one row per item per day ──────────────────────
create table if not exists public.values_price_history (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.values_items(id) on delete cascade,
  game_id      uuid not null references public.games(id) on delete cascade,
  history_date date not null,
  cheapest_usd numeric(12, 2),
  average_usd  numeric(12, 2),
  sample_size  integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint values_price_history_item_date_key unique (item_id, history_date)
);

create index if not exists values_price_history_game_date_idx
  on public.values_price_history (game_id, history_date desc);

-- ── 8. RLS — public pages read published rows; only service role writes ─────
alter table public.values_games            enable row level security;
alter table public.values_items            enable row level security;
alter table public.values_item_aliases     enable row level security;
alter table public.values_rejection_patterns enable row level security;
alter table public.values_raw_listings     enable row level security;
alter table public.values_prices           enable row level security;
alter table public.values_price_history    enable row level security;

-- Anon/authenticated read ONLY what a value page renders. Raw listings,
-- aliases, rejection patterns and the config stay service-role-only: they are
-- crawl internals and would hand a competitor the whole pipeline.
drop policy if exists values_items_public_read on public.values_items;
create policy values_items_public_read on public.values_items
  for select to anon, authenticated using (is_enabled);

drop policy if exists values_prices_public_read on public.values_prices;
create policy values_prices_public_read on public.values_prices
  for select to anon, authenticated using (true);

drop policy if exists values_price_history_public_read on public.values_price_history;
create policy values_price_history_public_read on public.values_price_history
  for select to anon, authenticated using (true);

-- No policy on values_games / values_raw_listings / values_item_aliases /
-- values_rejection_patterns: RLS on with no permissive policy = service role
-- only, which is the intent.

grant select on public.values_items         to anon, authenticated;
grant select on public.values_prices        to anon, authenticated;
grant select on public.values_price_history to anon, authenticated;

-- ── 9. updated_at triggers ─────────────────────────────────────────────────
create or replace function public.values_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.values_touch_updated_at() from anon, authenticated;

drop trigger if exists trg_values_games_touch on public.values_games;
create trigger trg_values_games_touch before update on public.values_games
  for each row execute function public.values_touch_updated_at();

drop trigger if exists trg_values_items_touch on public.values_items;
create trigger trg_values_items_touch before update on public.values_items
  for each row execute function public.values_touch_updated_at();

drop trigger if exists trg_values_prices_touch on public.values_prices;
create trigger trg_values_prices_touch before update on public.values_prices
  for each row execute function public.values_touch_updated_at();
