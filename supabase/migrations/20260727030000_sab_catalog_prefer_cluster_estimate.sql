-- Fix over-priced public values: rewire the catalog to Pipeline A.
--
-- The SAB DB has TWO parallel price pipelines (see sab-pricing-system-map):
--   A) sab_market_variant_price_estimates — reads individual listings, removes
--      outliers, clusters. CORRECT (Skibidi default = $222.50).
--   B) sab_external_variant_price_estimates → sab_trade_price_catalog — uses the
--      midpoint of a scraped WIDE range ($234-$439), so it over-prices
--      (Skibidi default = $323.75).
--
-- sab_public_price_catalog_rows() merged both but the coalesce preferred the
-- Pipeline-B "verified" value, so $323 won over $222. This migration flips the
-- merge to prefer the Pipeline-A marketplace ESTIMATE for the headline value +
-- range; the Pipeline-B verified value is now only a FALLBACK when there is no
-- estimate. Same function signature — downstream (sab_public_price_catalog
-- view) is unaffected.

create or replace function public.sab_public_price_catalog_rows()
returns table(
  brainrot_id uuid,
  brainrot_name text,
  brainrot_slug text,
  rarity text,
  image_url text,
  mutation_id uuid,
  mutation_name text,
  mutation_slug text,
  market_value_usd numeric,
  market_low_usd numeric,
  market_high_usd numeric,
  confidence_label text,
  external_sample_size integer,
  source_count integer,
  price_updated_at timestamp with time zone,
  is_trade_ready boolean,
  is_public_estimate boolean
)
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  with verified_prices as (
    select
      price.brainrot_id,
      price.mutation_id,
      price.market_value_usd::numeric(12, 2) as market_value_usd,
      coalesce(price.market_low_usd, price.market_value_usd)::numeric(12, 2) as market_low_usd,
      coalesce(price.market_high_usd, price.market_value_usd)::numeric(12, 2) as market_high_usd,
      coalesce(price.confidence_label, 'low')::text as confidence_label,
      coalesce(price.external_sample_size, 0)::integer as external_sample_size,
      price.price_updated_at::timestamptz as price_updated_at,
      price.is_trade_ready::boolean as is_trade_ready
    from public.sab_trade_price_catalog price
    where price.market_value_usd > 0
  ),

  marketplace_estimates as (
    select
      estimate.brainrot_id,
      estimate.mutation_id,
      estimate.estimate_usd::numeric(12, 2) as market_value_usd,
      coalesce(estimate.low_usd, estimate.estimate_usd)::numeric(12, 2) as market_low_usd,
      coalesce(estimate.high_usd, estimate.estimate_usd)::numeric(12, 2) as market_high_usd,
      case
        when estimate.total_sample_count >= 10 then 'high'
        when estimate.total_sample_count >= 5 then 'medium'
        else 'low'
      end::text as confidence_label,
      estimate.total_sample_count::integer as external_sample_size,
      estimate.source_count::integer as source_count,
      estimate.latest_observed_at::timestamptz as price_updated_at,
      estimate.is_trade_ready::boolean as is_trade_ready
    from public.sab_market_variant_price_estimates estimate
    where estimate.estimate_usd > 0
      and estimate.total_sample_count >= 1
  ),

  merged_prices as (
    select
      coalesce(estimate.brainrot_id, verified.brainrot_id) as brainrot_id,
      coalesce(estimate.mutation_id, verified.mutation_id) as mutation_id,

      -- PREFER PIPELINE A (the cluster-aware live estimate). Pipeline B
      -- (verified/wide-range) is a fallback only when there is no estimate.
      coalesce(estimate.market_value_usd, verified.market_value_usd)::numeric(12, 2)
        as market_value_usd,

      coalesce(
        estimate.market_low_usd,
        verified.market_low_usd,
        estimate.market_value_usd,
        verified.market_value_usd
      )::numeric(12, 2) as market_low_usd,

      coalesce(
        estimate.market_high_usd,
        verified.market_high_usd,
        estimate.market_value_usd,
        verified.market_value_usd
      )::numeric(12, 2) as market_high_usd,

      -- Confidence + sample size follow whichever value we chose: estimate
      -- first, verified as fallback.
      coalesce(estimate.confidence_label, verified.confidence_label, 'low')::text
        as confidence_label,

      coalesce(estimate.external_sample_size, verified.external_sample_size, 0)::integer
        as external_sample_size,

      coalesce(
        estimate.source_count,
        case when verified.brainrot_id is not null then 1 else 0 end
      )::integer as source_count,

      coalesce(
        greatest(verified.price_updated_at, estimate.price_updated_at),
        estimate.price_updated_at,
        verified.price_updated_at
      )::timestamptz as price_updated_at,

      (coalesce(estimate.is_trade_ready, false) or coalesce(verified.is_trade_ready, false))::boolean
        as is_trade_ready,

      (estimate.brainrot_id is not null)::boolean as is_public_estimate

    from marketplace_estimates estimate
    full join verified_prices verified
      on verified.brainrot_id = estimate.brainrot_id
     and verified.mutation_id = estimate.mutation_id
  )

  select
    brainrot.id::uuid as brainrot_id,
    brainrot.name::text as brainrot_name,
    brainrot.slug::text as brainrot_slug,
    brainrot.rarity::text as rarity,
    brainrot.image_url::text as image_url,
    mutation.id::uuid as mutation_id,
    mutation.name::text as mutation_name,
    mutation.slug::text as mutation_slug,
    merged.market_value_usd::numeric(12, 2) as market_value_usd,
    merged.market_low_usd::numeric(12, 2) as market_low_usd,
    merged.market_high_usd::numeric(12, 2) as market_high_usd,
    merged.confidence_label::text as confidence_label,
    merged.external_sample_size::integer as external_sample_size,
    merged.source_count::integer as source_count,
    merged.price_updated_at::timestamptz as price_updated_at,
    merged.is_trade_ready::boolean as is_trade_ready,
    merged.is_public_estimate::boolean as is_public_estimate
  from merged_prices merged
  join public.sab_brainrot_catalog brainrot
    on brainrot.id = merged.brainrot_id
  join public.sab_mutation_catalog mutation
    on mutation.id = merged.mutation_id
  where merged.market_value_usd > 0;
$function$;
