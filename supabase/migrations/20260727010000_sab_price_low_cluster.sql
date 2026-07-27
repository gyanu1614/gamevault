-- SAB pricing: low-cluster, outlier-resistant value.
--
-- Problem: the headline value over-priced right-skewed items. Skibidi Toilet
-- (default) had real listings clustered at $210-230 (7 of 11), plus an
-- aspirational tail at $295-450, yet the catalog showed ~$323. Two causes:
--   1. The outlier fence (Q3 + 1.5*IQR) was too permissive — it kept the high
--      aspirational tail, which pulled the median up.
--   2. The headline used the median (P50), which sits above the dense honest
--      cluster on a right-skewed distribution.
--
-- Fix (buyer-friendly "what you can realistically buy it for"):
--   • Tighten the upper outlier fence to Q3 + 1.0*spread so the aspirational
--     tail is trimmed (the lower fence stays lenient — cheap real listings are
--     signal, not noise).
--   • Anchor the headline value to the LOW cluster: P30 of the cleaned prices,
--     which lands in the dense low band ($210-230 → ~$220 for Skibidi).
--   • Report low/high as P20/P70 of the cleaned prices so the range reflects
--     the honest cluster, not the extremes.
--
-- Views recompute live, so applying this migration fixes every item at once;
-- no re-collection needed.

-- ============================================================
-- Tighter outlier fence
-- ============================================================

create or replace view
  public.sab_market_clean_listing_evidence
with (security_invoker = true)
as
with bounds as (
  select
    source_id,
    brainrot_id,
    mutation_id,
    listing_type,

    count(*) as evidence_count,

    percentile_cont(0.25)
      within group (order by unit_price_usd) as q1_usd,

    percentile_cont(0.50)
      within group (order by unit_price_usd) as median_usd,

    percentile_cont(0.75)
      within group (order by unit_price_usd) as q3_usd

  from public.sab_market_listing_candidates

  group by
    source_id,
    brainrot_id,
    mutation_id,
    listing_type
)

select
  candidate.*,
  bounds.evidence_count,
  bounds.q1_usd,
  bounds.median_usd,
  bounds.q3_usd

from public.sab_market_listing_candidates candidate

join bounds
  on bounds.source_id = candidate.source_id
 and bounds.brainrot_id = candidate.brainrot_id
 and bounds.mutation_id = candidate.mutation_id
 and bounds.listing_type = candidate.listing_type

where
  -- Too few samples to fence — keep everything.
  bounds.evidence_count < 4

  or candidate.unit_price_usd between
    -- Lower fence stays lenient (1.5x): cheap honest listings are the signal
    -- we want to anchor to, not outliers to discard.
    greatest(
      0.01,
      bounds.q1_usd
      - 1.5 * greatest(
          bounds.q3_usd - bounds.q1_usd,
          bounds.median_usd * 0.15
        )
    )
    and
    -- Upper fence tightened (1.5x -> 1.0x): trims the aspirational high tail
    -- that was inflating the value on right-skewed items.
    bounds.q3_usd
    + 1.0 * greatest(
        bounds.q3_usd - bounds.q1_usd,
        bounds.median_usd * 0.15
      );

-- ============================================================
-- One estimate per marketplace — low-cluster anchor
-- ============================================================

create or replace view
  public.sab_market_source_variant_estimates
with (security_invoker = true)
as
with ranked as (
  select
    evidence.*,

    case evidence.listing_type
      when 'completed_sale' then 1
      when 'active_listing' then 2
      else 9
    end as evidence_rank,

    min(
      case evidence.listing_type
        when 'completed_sale' then 1
        when 'active_listing' then 2
        else 9
      end
    ) over (
      partition by
        evidence.source_id,
        evidence.brainrot_id,
        evidence.mutation_id
    ) as best_evidence_rank

  from public.sab_market_clean_listing_evidence evidence
),
best_evidence as (
  select *
  from ranked
  where evidence_rank = best_evidence_rank
)

select
  source_id,
  source_slug,
  source_name,
  source_weight,

  brainrot_id,
  mutation_id,

  case min(evidence_rank)
    when 1 then 'completed_sale'
    when 2 then 'active_listing'
    else 'unknown'
  end as evidence_type,

  -- Headline value = P30 of the cleaned prices (low-cluster / buyer-friendly).
  -- Sits in the dense honest band rather than the middle of a skewed spread.
  percentile_cont(0.30)
    within group (order by unit_price_usd)::numeric(12, 2) as median_usd,

  -- Range reflects the honest cluster, not the extremes.
  percentile_cont(0.20)
    within group (order by unit_price_usd)::numeric(12, 2) as low_usd,

  percentile_cont(0.70)
    within group (order by unit_price_usd)::numeric(12, 2) as high_usd,

  count(*)::integer as sample_count,
  max(observed_at) as latest_observed_at

from best_evidence

group by
  source_id,
  source_slug,
  source_name,
  source_weight,
  brainrot_id,
  mutation_id;
