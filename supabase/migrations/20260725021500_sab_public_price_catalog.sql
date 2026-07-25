-- Public SAB display-price catalog.
--
-- Display confidence:
--   10+ exact recent listings => high
--   5-9 exact recent listings => medium
--   1-4 exact recent listings => low
--
-- Cash W/F/L remains controlled separately by is_trade_ready.

begin;

create or replace view public.sab_public_price_catalog
with (security_barrier = true)
as
select
  brainrot.id as brainrot_id,
  brainrot.name as brainrot_name,
  brainrot.slug as brainrot_slug,
  brainrot.rarity,
  brainrot.image_url,

  mutation.id as mutation_id,
  mutation.name as mutation_name,
  mutation.slug as mutation_slug,

  estimate.estimate_usd::numeric(12, 2)
    as market_value_usd,
  estimate.low_usd::numeric(12, 2)
    as market_low_usd,
  estimate.high_usd::numeric(12, 2)
    as market_high_usd,

  case
    when estimate.total_sample_count >= 10 then 'high'
    when estimate.total_sample_count >= 5 then 'medium'
    else 'low'
  end::text as confidence_label,

  estimate.total_sample_count::integer
    as external_sample_size,
  estimate.source_count::integer
    as source_count,
  estimate.latest_observed_at
    as price_updated_at,

  estimate.is_trade_ready::boolean
    as is_trade_ready,
  true::boolean
    as is_public_estimate

from public.sab_market_variant_price_estimates estimate

join public.sab_brainrot_catalog brainrot
  on brainrot.id = estimate.brainrot_id

join public.sab_mutation_catalog mutation
  on mutation.id = estimate.mutation_id

where estimate.estimate_usd >= 1.00
  and estimate.total_sample_count >= 1;

revoke all
on public.sab_public_price_catalog
from public;

grant select
on public.sab_public_price_catalog
to anon, authenticated, service_role;

comment on view public.sab_public_price_catalog is
  'Public SAB display estimates. Confidence uses exact recent listing count; '
  'cash trade readiness remains a separate stricter flag.';

commit;
