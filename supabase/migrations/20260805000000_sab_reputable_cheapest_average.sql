-- Reputable-seller pricing: cheapest + average, exposed to the value pages.
--
-- The correction pipeline now computes two buyer-facing numbers from sellers
-- with 100+ reviews: the reputable CHEAPEST (lowest real listing) and the
-- AVERAGE (typical price, which becomes the headline value). Both need a home on
-- sab_price_corrections and a passthrough on the public view.
--
-- Backward compatible: the columns are nullable and null on every non-reputable
-- correction path, and the view coalesces so nothing breaks for rows that don't
-- have a reputable split yet (e.g. G2G/Itemku-only items, or before the
-- collector rerun populates seller review counts).

alter table public.sab_price_corrections
  add column if not exists cheapest_usd numeric(12, 2),
  add column if not exists average_usd numeric(12, 2);

-- Redefine the view to surface the two new numbers. Column-additive: every
-- existing column stays in place and order; cheapest_usd / average_usd are
-- appended so existing readers are unaffected.
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
    as cohort_size,

  -- Reputable-seller cheapest + average. Null when this row wasn't priced by the
  -- reputable path; the UI shows only what is present.
  correction.cheapest_usd::numeric(12, 2) as cheapest_usd,
  correction.average_usd::numeric(12, 2) as average_usd

from public.sab_public_price_catalog as catalog

left join public.sab_price_corrections as correction
  on correction.brainrot_id = catalog.brainrot_id
  and correction.mutation_id = catalog.mutation_id

where coalesce(correction.is_publishable, true);

revoke all on public.sab_public_price_catalog_corrected from public;

grant select
on public.sab_public_price_catalog_corrected
to anon, authenticated, service_role;
