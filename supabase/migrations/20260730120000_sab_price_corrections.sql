-- SAB price corrections — the accuracy layer over the raw market estimates.
--
-- Verified against production 2026-07-30, the published catalog has three
-- measurable accuracy faults:
--   * no minimum evidence: 23 items publish a price from ONE listing, 53 of
--     423 rest on n<=2. Spyder Elephant, a 1T-cost OG, published at $9.98 off
--     a single listing while its peers sit near $293.
--   * no external anchor: nothing compares an item against comparable items,
--     so an absurd price publishes unchallenged.
--   * mutation prices assumed the income multiplier. Measured over 1,155
--     well-sampled variant/default pairs the market premium saturates near
--     2.5-3.5x: Rainbow is 10x income but only ~3.0x price.
--
-- DELIBERATELY ADDITIVE. The pricing views/functions were hand-edited outside
-- migrations (see the pricing system map), so their live definitions cannot be
-- reconstructed from this repo. Rather than rewrite objects we cannot read,
-- this migration adds two tables and one new view that reads the existing
-- catalog and merges corrections over it. Nothing existing is modified, so the
-- change is reversible by dropping these three objects.
--
-- Correction logic lives in TypeScript (src/lib/sab/price-correction.ts, unit
-- tested) and is applied by the /api/cron/correct-sab-prices job. Keeping it
-- out of SQL is what stops this layer from drifting the way the last one did.

-- ---------------------------------------------------------------------------
-- Per-variant corrections
-- ---------------------------------------------------------------------------

create table if not exists public.sab_price_corrections (
  brainrot_id uuid not null
    references public.sab_brainrots (id) on delete cascade,
  mutation_id uuid not null
    references public.sab_mutations (id) on delete cascade,

  -- Corrected figures. Null together when the row is not publishable.
  value_usd numeric(12, 2),
  low_usd numeric(12, 2),
  high_usd numeric(12, 2),

  -- What the uncorrected pipeline said, kept so a correction is auditable and
  -- can be reversed without re-running the whole pipeline.
  original_value_usd numeric(12, 2),

  reason text not null,
  confidence_label text not null,

  anchor_usd numeric(12, 2),
  cohort_size integer not null default 0,
  sample_count integer not null default 0,

  is_anchored boolean not null default false,
  -- False means "we do not know" — the read view drops these rows entirely
  -- rather than showing a number no evidence supports.
  is_publishable boolean not null default true,

  computed_at timestamptz not null default now(),

  primary key (brainrot_id, mutation_id),

  constraint sab_price_corrections_reason_check check (
    reason in (
      'floor',
      'trusted',
      'thin_sample_within_anchor',
      'thin_sample_anchored',
      'insufficient_evidence',
      'variant_anchored'
    )
  ),

  constraint sab_price_corrections_publishable_has_value check (
    not is_publishable or value_usd is not null
  )
);

comment on table public.sab_price_corrections is
  'Accuracy corrections merged over sab_public_price_catalog. One row per '
  '(brainrot, mutation). Written by /api/cron/correct-sab-prices; read '
  'through sab_public_price_catalog_corrected.';

create index if not exists sab_price_corrections_publishable_idx
  on public.sab_price_corrections (brainrot_id, mutation_id)
  where is_publishable;

alter table public.sab_price_corrections enable row level security;

-- Public read: these are the same prices the value pages already show.
-- Writes are service-role only, which bypasses RLS, so no write policy exists.
drop policy if exists sab_price_corrections_public_read
  on public.sab_price_corrections;

create policy sab_price_corrections_public_read
  on public.sab_price_corrections
  for select
  to anon, authenticated
  using (true);

revoke all on public.sab_price_corrections from public;
grant select on public.sab_price_corrections to anon, authenticated;
grant all on public.sab_price_corrections to service_role;

-- ---------------------------------------------------------------------------
-- Measured mutation price multipliers
-- ---------------------------------------------------------------------------

create table if not exists public.sab_mutation_price_multipliers (
  mutation_slug text primary key,
  -- What the market actually pays for this mutation as a multiple of the same
  -- Brainrot's default price. NOT the income multiplier.
  price_multiplier numeric(8, 3) not null,
  -- Well-sampled variant/default pairs behind the measurement.
  pair_count integer not null,
  computed_at timestamptz not null default now(),

  constraint sab_mutation_price_multipliers_positive check (
    price_multiplier > 0
  )
);

comment on table public.sab_mutation_price_multipliers is
  'Empirically measured mutation price premiums, re-measured on each cron run. '
  'Replaces the income-multiplier assumption for estimated variant prices, '
  'which overstated high-tier mutations roughly threefold.';

alter table public.sab_mutation_price_multipliers enable row level security;

drop policy if exists sab_mutation_price_multipliers_public_read
  on public.sab_mutation_price_multipliers;

create policy sab_mutation_price_multipliers_public_read
  on public.sab_mutation_price_multipliers
  for select
  to anon, authenticated
  using (true);

revoke all on public.sab_mutation_price_multipliers from public;
grant select on public.sab_mutation_price_multipliers to anon, authenticated;
grant all on public.sab_mutation_price_multipliers to service_role;

-- ---------------------------------------------------------------------------
-- The corrected read surface
-- ---------------------------------------------------------------------------
--
-- Column-compatible with sab_public_price_catalog (same names, same order) plus
-- four correction columns, so a caller migrates by changing the table name and
-- nothing else.

create or replace view public.sab_public_price_catalog_corrected
with (
  security_barrier = true,
  security_invoker = true
)
as
select
  catalog.brainrot_id,
  catalog.brainrot_name,
  catalog.brainrot_slug,
  catalog.rarity,
  catalog.image_url,

  catalog.mutation_id,
  catalog.mutation_name,
  catalog.mutation_slug,

  coalesce(correction.value_usd, catalog.market_value_usd)::numeric(12, 2)
    as market_value_usd,
  coalesce(correction.low_usd, catalog.market_low_usd)::numeric(12, 2)
    as market_low_usd,
  coalesce(correction.high_usd, catalog.market_high_usd)::numeric(12, 2)
    as market_high_usd,

  coalesce(correction.confidence_label, catalog.confidence_label)::text
    as confidence_label,
  catalog.external_sample_size,
  catalog.source_count,
  -- Correction freshness when corrected, else the raw catalog time. See the
  -- 20260801000000 migration for the rationale.
  coalesce(correction.computed_at, catalog.price_updated_at)
    as price_updated_at,

  catalog.is_trade_ready,
  catalog.is_public_estimate,

  coalesce(correction.is_anchored, false)
    as is_anchored,
  correction.reason
    as correction_reason,
  correction.anchor_usd,
  coalesce(correction.cohort_size, 0)
    as cohort_size

from public.sab_public_price_catalog as catalog

left join public.sab_price_corrections as correction
  on correction.brainrot_id = catalog.brainrot_id
  and correction.mutation_id = catalog.mutation_id

-- A row with no correction yet is passed through untouched, so the view is
-- safe to point traffic at before the first cron run.
where coalesce(correction.is_publishable, true);

revoke all on public.sab_public_price_catalog_corrected from public;

grant select
on public.sab_public_price_catalog_corrected
to anon, authenticated, service_role;

comment on view public.sab_public_price_catalog_corrected is
  'sab_public_price_catalog with accuracy corrections merged over it. Rows '
  'whose correction is not publishable are withheld. Prefer this view over '
  'sab_public_price_catalog for anything user-facing.';
