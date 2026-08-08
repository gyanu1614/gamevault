-- ============================================================================
-- Adopt Me reputable-seller pricing
-- ============================================================================
-- Brings Adopt Me onto the SAME pricing model SAB uses: a value is real only if
-- REPUTABLE sellers (100+ reviews) offer it, and we publish a buyer-facing
-- CHEAPEST + MARKET (average) instead of a noisy cluster median.
--
-- Two changes:
--   1. adopt_me_market_raw_listings — a raw per-listing table (mirrors
--      sab_market_raw_listings' role). The collector dumps every clean listing
--      here with its seller review count; the unified correct-prices cron reads
--      it and computes reputable prices. Previously the collector priced inline
--      and threw the per-listing data away, so there was nothing to re-price.
--   2. cheapest_usd / average_usd / reputable_count on adopt_me_pet_values —
--      the buyer-facing split, exactly like sab_price_corrections.
--
-- Security posture matches the rest of Adopt Me: public may read published
-- values; raw listings are service-role only (internal pricing input, never
-- shown raw). Safe to re-run.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Buyer-facing reputable columns on the values table
-- ---------------------------------------------------------------------------
alter table public.adopt_me_pet_values
  add column if not exists cheapest_usd    numeric(10,2),
  add column if not exists average_usd     numeric(10,2),
  add column if not exists reputable_count integer;

comment on column public.adopt_me_pet_values.cheapest_usd is
  'Lowest price a reputable (100+ review) seller offers, cluster-supported. '
  'NULL when there is no reputable evidence — never a fabricated floor.';
comment on column public.adopt_me_pet_values.average_usd is
  'Typical reputable price (median of the cheapest reputable listings, spread-'
  'capped). The headline "market price" shown to buyers.';
comment on column public.adopt_me_pet_values.reputable_count is
  'How many reputable listings backed cheapest/average this run (transparency).';

-- ---------------------------------------------------------------------------
-- 2. Raw per-listing table — the pricing input
-- ---------------------------------------------------------------------------
-- One row per observed marketplace listing for a pet+variant. The collector
-- upserts the current snapshot; the cron reads it. `reviews` is the seller's
-- total review/order count (Eldorado ratingCount) — the reputable gate. Rows
-- without it still store (for dedup/floor) but won't count as reputable.
create table if not exists public.adopt_me_market_raw_listings (
  id             uuid primary key default gen_random_uuid(),
  pet_id         uuid not null
    references public.adopt_me_pets (id) on delete cascade,

  variant        text not null
    check (variant in ('N','F','R','FR','NEON','NFR','MEGA','MFR')),

  source         text not null default 'eldorado',   -- eldorado / g2g / u7buy
  price_usd      numeric(10,2) not null,

  -- Seller reputation, the reputable-pricing signal.
  reviews        integer,          -- total reviews/orders (ratingCount)
  seller_rating  numeric,          -- positive % (feedbackScore)
  seller_id      text,             -- for dedup (one seller, N identical copies)

  -- Provenance for debugging / dedup. The listing title as seen.
  title          text,

  -- Listing lifecycle so a re-crawl can retire vanished listings without
  -- deleting history mid-run (mirrors SAB's listing_status).
  listing_status text not null default 'active'
    check (listing_status in ('active','ended')),

  collected_at   timestamptz not null default now(),
  ended_at       timestamptz,

  -- One logical listing per (pet, variant, source, seller, price): a re-crawl
  -- of the same offer updates in place rather than piling duplicates.
  unique (pet_id, variant, source, seller_id, price_usd)
);

comment on table public.adopt_me_market_raw_listings is
  'Raw Adopt Me marketplace listings (one row per offer). Input to the unified '
  'correct-prices cron, which computes reputable cheapest/average from the '
  '100+ review sellers here. Service-role only — never shown raw to users.';

create index if not exists adopt_me_raw_pet_variant_idx
  on public.adopt_me_market_raw_listings (pet_id, variant);
create index if not exists adopt_me_raw_status_idx
  on public.adopt_me_market_raw_listings (listing_status);

-- ---------------------------------------------------------------------------
-- RLS — raw listings are internal; no public read at all
-- ---------------------------------------------------------------------------
alter table public.adopt_me_market_raw_listings enable row level security;
revoke all on public.adopt_me_market_raw_listings from public;
grant select, insert, update, delete
  on public.adopt_me_market_raw_listings to service_role;
-- (no anon/authenticated policy — clients never read raw listings)

commit;
