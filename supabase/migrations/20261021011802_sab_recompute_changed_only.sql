-- SAB recompute steps write only rows that change (2026-10-20 usage audit,
-- C9/17). Both run on every reprice.
--   * sab_recompute_tradeable rewrote every sab_brainrots row each run (and
--     returned 498 as "changed"); now only rows whose flag differs, and the
--     count is the real number changed.
--   * sab_publish_market_estimates re-deactivated automated observations that
--     were already inactive; now only active ones. The rest of the function
--     is the baseline body unchanged.

create or replace function public.sab_recompute_tradeable()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  changed bigint;
begin
  with computed as (
    select b.id,
           (
             exists (
               select 1 from public.sab_price_corrections c
               where c.brainrot_id = b.id
                 and c.is_publishable
                 and c.reason in ('reputable', 'trusted')
             )
             or b.popularity_rank is not null
           ) as tradeable
    from public.sab_brainrots b
  )
  update public.sab_brainrots b
  set is_tradeable = computed.tradeable
  from computed
  where computed.id = b.id
    and b.is_tradeable is distinct from computed.tradeable;
  get diagnostics changed = row_count;
  return changed;
end
$$;

CREATE OR REPLACE FUNCTION "public"."sab_publish_market_estimates"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "statement_timeout" TO '120s'
    AS $$
declare
  published_count bigint;
begin
  update public.sab_external_market_observations
    observation
  set
    is_active = false,
    updated_at = now()
  where observation.source_name =
      'Automated multi-market estimate'
    and observation.source_reference like
      'auto-multi-market:%'
    -- 2026-10-20: only rows still active (it re-deactivated inactive ones).
    and observation.is_active = true
    and not exists (
      select 1
      from public.sab_market_variant_price_estimates
        estimate
      where estimate.is_trade_ready = true
        and observation.source_reference =
          'auto-multi-market:'
          || estimate.brainrot_id::text
          || ':'
          || estimate.mutation_id::text
    );

  insert into public.sab_external_market_observations (
    brainrot_id,
    mutation_id,

    observation_type,

    source_name,
    source_reference,

    currency,

    price_usd,
    price_low_usd,
    price_high_usd,

    sample_size,
    confidence_score,

    observed_at,
    expires_at,

    is_verified,
    is_active,

    notes
  )
  select
    estimate.brainrot_id,
    estimate.mutation_id,

    'market_range',

    'Automated multi-market estimate',
    'auto-multi-market:'
      || estimate.brainrot_id::text
      || ':'
      || estimate.mutation_id::text,

    'USD',

    estimate.estimate_usd,
    estimate.low_usd,
    estimate.high_usd,

    estimate.total_sample_count,

    case estimate.confidence_label
      when 'high' then 0.850
      when 'medium' then 0.700
      when 'low' then 0.550
      else 0.400
    end,

    estimate.latest_observed_at,
    now() + interval '48 hours',

    false,
    true,

    format(
      'Automated estimate from %s marketplace(s) and %s valid listing(s)',
      estimate.source_count,
      estimate.total_sample_count
    )

  from public.sab_market_variant_price_estimates
    estimate

  where estimate.is_trade_ready = true
    and estimate.estimate_usd >= 1.00

  on conflict (
    source_name,
    source_reference
  )
  where source_reference is not null

  do update set
    observation_type =
      excluded.observation_type,

    price_usd =
      excluded.price_usd,

    price_low_usd =
      excluded.price_low_usd,

    price_high_usd =
      excluded.price_high_usd,

    sample_size =
      excluded.sample_size,

    confidence_score =
      excluded.confidence_score,

    observed_at =
      excluded.observed_at,

    expires_at =
      excluded.expires_at,

    is_active = true,

    notes =
      excluded.notes,

    updated_at = now();

  get diagnostics published_count = row_count;

  return published_count;
end;
$$;

revoke all on function public.sab_recompute_tradeable() from public, anon, authenticated;
grant execute on function public.sab_recompute_tradeable() to service_role;
revoke all on function public.sab_publish_market_estimates() from public, anon, authenticated;
grant execute on function public.sab_publish_market_estimates() to service_role;
