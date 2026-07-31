-- ============================================================================
-- Adopt Me values data model
-- ============================================================================
-- Mirrors the SAB catalog's shape and security posture (public read, writes
-- locked to service_role) but models Adopt Me's ACTUAL economy, which differs
-- from SAB in two ways that matter:
--
--   * No income/s. Adopt Me pets don't generate income, so there is no
--     base_income_per_second / mutation multiplier column here.
--   * No "mutations". The price dimension is the 8-form potion/Neon ladder
--     (N,F,R,FR,NEON,NFR,MEGA,MFR) — one value row per pet per variant.
--
-- Design choices vs the task brief, and why:
--   * text + CHECK, not native pg enums. The SAB base tables store rarity as
--     free text; enums are painful to evolve (ALTER TYPE) and this vocabulary
--     will move as data lands. CHECK constraints give the same safety and edit
--     cleanly. Values are stored canonical (lowercase_snake) and mapped to
--     display labels in the UI.
--   * adopt_me_pet_values is a plain table the nightly seed writes into — NOT a
--     view over a market-aggregation table, because at launch there is no
--     scraper pipeline (unlike SAB). A public view can layer on later once a
--     real pricing feed exists.
--   * is_estimated is a first-class column. At launch EVERY Adopt Me cash value
--     is derived (the marketplace has no Adopt Me sales yet), so "estimated vs
--     observed" must be queryable and renderable, never implicit.
--
-- Safe to re-run: guarded with IF NOT EXISTS / idempotent policy drops.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- adopt_me_pets — one row per tradable pet (variant-agnostic)
-- ---------------------------------------------------------------------------
create table if not exists public.adopt_me_pets (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,

  -- Adopt Me rarity ladder (canonical lowercase). Ultra-Rare is a real tier
  -- between Rare and Legendary and is easy to forget — it's in the CHECK.
  rarity        text not null
    check (rarity in ('common','uncommon','rare','ultra_rare','legendary')),

  -- Can you still get this pet, is it event-limited, or fully retired.
  obtainability text not null default 'obtainable'
    check (obtainability in ('obtainable','limited','unobtainable')),

  -- Where the pet originally came from — context for the per-pet page (TASK-3).
  origin_type   text
    check (origin_type is null or origin_type in
      ('egg','event','shop','robux','gamepass','minigame','promo')),
  origin_detail text,                 -- e.g. 'Halloween Event 2019'

  released_at   date,
  retired_at    date,

  image_url     text,                 -- adopt-me-pets bucket, {slug}.webp

  demand_rank   integer,             -- community demand rank (nullable)
  demand_trend  text default 'stable'
    check (demand_trend in ('rising','stable','falling')),

  -- 100-150 words of genuine per-pet context (TASK-3). A pet without this
  -- stays is_active=false: no thin programmatic page ships without real copy.
  description   text,

  -- is_active gates BOTH the value list and the per-pet route. A pet is only
  -- active once it has been priced AND described — so we never publish an
  -- empty or thin page (this is what avoids the soft-404 class of problem).
  is_active     boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.adopt_me_pets is
  'Adopt Me tradable pets (variant-agnostic). One page per row at '
  '/adopt-me/values/{slug}. is_active requires both a price and a description.';

create index if not exists adopt_me_pets_rarity_idx
  on public.adopt_me_pets (rarity);
create index if not exists adopt_me_pets_demand_rank_idx
  on public.adopt_me_pets (demand_rank);
create index if not exists adopt_me_pets_active_idx
  on public.adopt_me_pets (is_active);

-- ---------------------------------------------------------------------------
-- adopt_me_pet_values — one row per pet PER variant (8 per fully-priced pet)
-- ---------------------------------------------------------------------------
create table if not exists public.adopt_me_pet_values (
  id               uuid primary key default gen_random_uuid(),
  pet_id           uuid not null
    references public.adopt_me_pets (id) on delete cascade,

  -- The 8-form ladder. FR (Fly Ride) is the standard trading benchmark and the
  -- value list's default column.
  variant          text not null
    check (variant in ('N','F','R','FR','NEON','NFR','MEGA','MFR')),

  -- The two numbers that are the whole product (dual-axis):
  --   cash_value_usd  — DropMarket USD cash value (median of sales+listings;
  --                     at launch a derived estimate, see is_estimated)
  --   trade_value     — community consensus points, for WFL trade checks
  cash_value_usd   numeric(10,2),
  trade_value      numeric,

  -- Real listings/sales behind the number; drives the confidence label.
  listings_tracked integer not null default 0,

  -- Stored (not just derived in a view) because the seed sets it from
  -- listings_tracked and there is no aggregation table to compute it from yet.
  -- Threshold rule lives in one place: adopt_me_confidence_for() below.
  confidence       text not null default 'low'
    check (confidence in ('highly_accurate','high','medium','low')),

  -- TRUE = derived estimate, FALSE = built from real observed DropMarket
  -- activity. At launch everything is TRUE. The UI must render these visibly
  -- differently — never present an estimate as observed.
  is_estimated     boolean not null default true,

  -- 7-day % change. NULL unless we hold ≥2 days of history for this variant;
  -- the UI suppresses the change indicator when NULL (never invents movement).
  price_change_7d  numeric,

  last_priced_at   timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (pet_id, variant)
);

comment on table public.adopt_me_pet_values is
  'One row per Adopt Me pet per variant (N..MFR). Dual-axis: cash_value_usd '
  '(DropMarket USD) + trade_value (community points). is_estimated flags '
  'derived vs observed; all rows start estimated until real sales exist.';

create index if not exists adopt_me_pet_values_pet_variant_idx
  on public.adopt_me_pet_values (pet_id, variant);
create index if not exists adopt_me_pet_values_variant_idx
  on public.adopt_me_pet_values (variant);

-- ---------------------------------------------------------------------------
-- adopt_me_price_history — immutable daily snapshot (sparklines + 7d change)
-- ---------------------------------------------------------------------------
create table if not exists public.adopt_me_price_history (
  id             uuid primary key default gen_random_uuid(),
  pet_id         uuid not null
    references public.adopt_me_pets (id) on delete cascade,
  variant        text not null
    check (variant in ('N','F','R','FR','NEON','NFR','MEGA','MFR')),
  cash_value_usd numeric(10,2),
  is_estimated   boolean not null default true,
  history_date   date not null,
  recorded_at    timestamptz not null default now(),

  -- One row per pet/variant/day — the nightly job upserts on this.
  unique (pet_id, variant, history_date)
);

comment on table public.adopt_me_price_history is
  'Immutable daily price snapshot per Adopt Me (pet, variant). Powers '
  'sparklines and the 7d change. Cannot be backfilled; the nightly job is '
  'the only writer. Change indicators need ≥2 distinct days.';

create index if not exists adopt_me_price_history_pet_variant_date_idx
  on public.adopt_me_price_history (pet_id, variant, history_date desc);

-- ---------------------------------------------------------------------------
-- Confidence threshold — ONE source of truth (mirrors SAB's tiers)
-- ---------------------------------------------------------------------------
-- ≥25 → highly_accurate · 10-24 → high · 3-9 → medium · <3 → low
-- The seed and any future refresh call this so the label can never drift from
-- the listing count it claims to reflect.
create or replace function public.adopt_me_confidence_for(listings integer)
returns text
language sql
immutable
as $$
  select case
    when listings >= 25 then 'highly_accurate'
    when listings >= 10 then 'high'
    when listings >= 3  then 'medium'
    else 'low'
  end
$$;

comment on function public.adopt_me_confidence_for(integer) is
  'Maps listings_tracked to a confidence label. Single source of truth for '
  'the ≥25/10/3 thresholds — callers must not hardcode them.';

-- ---------------------------------------------------------------------------
-- updated_at touch trigger (shared function if present, else create)
-- ---------------------------------------------------------------------------
create or replace function public.adopt_me_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists adopt_me_pets_touch on public.adopt_me_pets;
create trigger adopt_me_pets_touch
  before update on public.adopt_me_pets
  for each row execute function public.adopt_me_touch_updated_at();

drop trigger if exists adopt_me_pet_values_touch on public.adopt_me_pet_values;
create trigger adopt_me_pet_values_touch
  before update on public.adopt_me_pet_values
  for each row execute function public.adopt_me_touch_updated_at();

-- ============================================================================
-- Row Level Security — public read, writes locked to service_role
-- (exact posture of sab_price_history / the SAB catalog)
-- ============================================================================

-- adopt_me_pets --------------------------------------------------------------
alter table public.adopt_me_pets enable row level security;
revoke all on public.adopt_me_pets from public;
grant select on public.adopt_me_pets to anon, authenticated, service_role;

drop policy if exists adopt_me_pets_public_read on public.adopt_me_pets;
create policy adopt_me_pets_public_read
  on public.adopt_me_pets
  for select
  to anon, authenticated
  using (is_active = true);   -- clients only ever see live pets

-- adopt_me_pet_values --------------------------------------------------------
alter table public.adopt_me_pet_values enable row level security;
revoke all on public.adopt_me_pet_values from public;
grant select on public.adopt_me_pet_values to anon, authenticated, service_role;

drop policy if exists adopt_me_pet_values_public_read on public.adopt_me_pet_values;
create policy adopt_me_pet_values_public_read
  on public.adopt_me_pet_values
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.adopt_me_pets p
      where p.id = adopt_me_pet_values.pet_id
        and p.is_active = true
    )
  );

-- adopt_me_price_history -----------------------------------------------------
alter table public.adopt_me_price_history enable row level security;
revoke all on public.adopt_me_price_history from public;
grant select on public.adopt_me_price_history to anon, authenticated, service_role;

drop policy if exists adopt_me_price_history_public_read on public.adopt_me_price_history;
create policy adopt_me_price_history_public_read
  on public.adopt_me_price_history
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.adopt_me_pets p
      where p.id = adopt_me_price_history.pet_id
        and p.is_active = true
    )
  );

commit;
