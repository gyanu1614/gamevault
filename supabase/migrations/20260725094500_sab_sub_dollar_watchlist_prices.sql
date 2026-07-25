-- Publish positive sub-dollar SAB prices without replacing dependent views.
-- The existing candidate view keeps its schema; per-variant watchlist thresholds
-- lower the evidence floor to $0.01. The public catalog function keeps the same
-- return signature and remains the SECURITY DEFINER boundary for website roles.

begin;

insert into public.sab_market_watchlist (
  brainrot_id,
  mutation_id,
  minimum_cash_value_usd
)
select distinct
  listing.brainrot_id,
  listing.mutation_id,
  0.01::numeric
from public.sab_market_raw_listings listing
join public.sab_mutations mutation
  on mutation.id = listing.mutation_id
 and mutation.slug = 'default'
where listing.parse_status = 'matched'
  and listing.brainrot_id is not null
  and listing.mutation_id is not null
  and listing.currency = 'USD'
  and listing.unit_price_usd > 0
on conflict (brainrot_id, mutation_id)
do update set
  minimum_cash_value_usd = least(
    coalesce(
      public.sab_market_watchlist.minimum_cash_value_usd,
      excluded.minimum_cash_value_usd
    ),
    excluded.minimum_cash_value_usd
  );

create or replace function public.sab_public_price_catalog_rows()
returns table (
  brainrot_id uuid,
  brainrot_name text,
  brainrot_slug text,
  rarity text,
  image_url text,

  mutation_id uuid,
  mutation_name text,
  mutation_slug text,

  market_value_usd numeric(12, 2),
  market_low_usd numeric(12, 2),
  market_high_usd numeric(12, 2),

  confidence_label text,
  external_sample_size integer,
  source_count integer,
  price_updated_at timestamptz,

  is_trade_ready boolean,
  is_public_estimate boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  with verified_prices as (
    select
      price.brainrot_id,
      price.mutation_id,

      price.market_value_usd::numeric(12, 2)
        as market_value_usd,

      coalesce(
        price.market_low_usd,
        price.market_value_usd
      )::numeric(12, 2) as market_low_usd,

      coalesce(
        price.market_high_usd,
        price.market_value_usd
      )::numeric(12, 2) as market_high_usd,

      coalesce(
        price.confidence_label,
        'low'
      )::text as confidence_label,

      coalesce(
        price.external_sample_size,
        0
      )::integer as external_sample_size,

      price.price_updated_at::timestamptz
        as price_updated_at,

      price.is_trade_ready::boolean
        as is_trade_ready

    from public.sab_trade_price_catalog price

    where price.market_value_usd > 0
  ),

  marketplace_estimates as (
    select
      estimate.brainrot_id,
      estimate.mutation_id,

      estimate.estimate_usd::numeric(12, 2)
        as market_value_usd,

      coalesce(
        estimate.low_usd,
        estimate.estimate_usd
      )::numeric(12, 2) as market_low_usd,

      coalesce(
        estimate.high_usd,
        estimate.estimate_usd
      )::numeric(12, 2) as market_high_usd,

      case
        when estimate.total_sample_count >= 10 then 'high'
        when estimate.total_sample_count >= 5 then 'medium'
        else 'low'
      end::text as confidence_label,

      estimate.total_sample_count::integer
        as external_sample_size,

      estimate.source_count::integer
        as source_count,

      estimate.latest_observed_at::timestamptz
        as price_updated_at,

      estimate.is_trade_ready::boolean
        as is_trade_ready

    from public.sab_market_variant_price_estimates estimate

    where estimate.estimate_usd > 0
      and estimate.total_sample_count >= 1
  ),

  merged_prices as (
    select
      coalesce(
        verified.brainrot_id,
        estimate.brainrot_id
      ) as brainrot_id,

      coalesce(
        verified.mutation_id,
        estimate.mutation_id
      ) as mutation_id,

      coalesce(
        verified.market_value_usd,
        estimate.market_value_usd
      )::numeric(12, 2) as market_value_usd,

      coalesce(
        verified.market_low_usd,
        estimate.market_low_usd,
        verified.market_value_usd,
        estimate.market_value_usd
      )::numeric(12, 2) as market_low_usd,

      coalesce(
        verified.market_high_usd,
        estimate.market_high_usd,
        verified.market_value_usd,
        estimate.market_value_usd
      )::numeric(12, 2) as market_high_usd,

      coalesce(
        estimate.confidence_label,
        verified.confidence_label,
        'low'
      )::text as confidence_label,

      coalesce(
        estimate.external_sample_size,
        verified.external_sample_size,
        0
      )::integer as external_sample_size,

      coalesce(
        estimate.source_count,
        case
          when verified.brainrot_id is not null then 1
          else 0
        end
      )::integer as source_count,

      coalesce(
        greatest(
          verified.price_updated_at,
          estimate.price_updated_at
        ),
        verified.price_updated_at,
        estimate.price_updated_at
      )::timestamptz as price_updated_at,

      (
        coalesce(verified.is_trade_ready, false)
        or coalesce(estimate.is_trade_ready, false)
      )::boolean as is_trade_ready,

      (
        estimate.brainrot_id is not null
      )::boolean as is_public_estimate

    from verified_prices verified

    full join marketplace_estimates estimate
      on estimate.brainrot_id = verified.brainrot_id
     and estimate.mutation_id = verified.mutation_id
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

    merged.market_value_usd::numeric(12, 2)
      as market_value_usd,
    merged.market_low_usd::numeric(12, 2)
      as market_low_usd,
    merged.market_high_usd::numeric(12, 2)
      as market_high_usd,

    merged.confidence_label::text
      as confidence_label,
    merged.external_sample_size::integer
      as external_sample_size,
    merged.source_count::integer
      as source_count,
    merged.price_updated_at::timestamptz
      as price_updated_at,

    merged.is_trade_ready::boolean
      as is_trade_ready,
    merged.is_public_estimate::boolean
      as is_public_estimate

  from merged_prices merged

  join public.sab_brainrot_catalog brainrot
    on brainrot.id = merged.brainrot_id

  join public.sab_mutation_catalog mutation
    on mutation.id = merged.mutation_id

  where merged.market_value_usd > 0;
$function$;

alter function public.sab_public_price_catalog_rows()
owner to postgres;

-- Undo temporary frontend grants used while diagnosing the public wrapper.
drop policy if exists "Public can read SAB pricing policy"
on public.sab_market_pricing_policy;

revoke all
on public.sab_market_pricing_policy
from anon, authenticated;

revoke all
on public.sab_market_raw_listings
from anon, authenticated;

revoke all
on function public.sab_public_price_catalog_rows()
from public, anon, authenticated;

grant execute
on function public.sab_public_price_catalog_rows()
to anon, authenticated, service_role;

revoke all
on public.sab_public_price_catalog
from public;

grant select
on public.sab_public_price_catalog
to anon, authenticated, service_role;

select public.sab_publish_market_estimates();

notify pgrst, 'reload schema';

commit;
