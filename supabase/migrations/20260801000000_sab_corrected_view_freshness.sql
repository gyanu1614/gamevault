-- Surface the correction's own timestamp as price_updated_at.
--
-- The corrected view showed catalog.price_updated_at, which is the RAW listing
-- aggregate's timestamp — the oldest observation in the group. So a price we
-- freshly corrected today (Radioactive Skibidi $70 -> $622) still read "updated
-- 6 days ago", because the underlying stale listings hadn't refreshed.
--
-- When a correction exists, the shown price was produced by that correction, so
-- its computed_at is the honest "when was THIS price set" — a fresh price gets a
-- fresh timestamp. Falls back to the raw catalog time for uncorrected rows.
--
-- Column-compatible redefinition (same columns, same order); only the
-- price_updated_at expression changes.

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

  -- The correction's own freshness when a correction produced this price;
  -- otherwise the raw catalog timestamp.
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

where coalesce(correction.is_publishable, true);

revoke all on public.sab_public_price_catalog_corrected from public;

grant select
on public.sab_public_price_catalog_corrected
to anon, authenticated, service_role;
