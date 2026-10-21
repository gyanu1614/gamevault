-- sab_reprice_reference(): the SAB reprice's two reference views in ONE call,
-- each computed once (2026-10-20 usage audit, C1).
--
-- The reprice paged both views 1000 rows at a time:
--   * sab_public_price_catalog (~3.6k rows) is a view over the SECURITY DEFINER
--     function sab_public_price_catalog_rows(), which Postgres cannot inline,
--     so every page re-ran the whole estimates chain (4 recomputes a run);
--   * sab_brainrot_mutation_calculator (~7k rows) is a brainrots × mutations
--     cross join, recomputed for each of its 8 pages.
-- A jsonb scalar is not subject to PostgREST's 1000-row cap, so the reprice
-- gets both complete arrays from one request.
--
-- Invoker rights (the service role calls it); not callable by anon or a
-- signed-in session.

create or replace function public.sab_reprice_reference()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'catalog', coalesce((
      select jsonb_agg(jsonb_build_object(
        'brainrot_id',          c.brainrot_id,
        'mutation_id',          c.mutation_id,
        'mutation_slug',        c.mutation_slug,
        'market_value_usd',     c.market_value_usd,
        'market_low_usd',       c.market_low_usd,
        'market_high_usd',      c.market_high_usd,
        'confidence_label',     c.confidence_label,
        'external_sample_size', c.external_sample_size,
        'source_count',         c.source_count
      ) order by c.brainrot_id, c.mutation_id)
      from public.sab_public_price_catalog c
    ), '[]'::jsonb),
    'calculator', coalesce((
      select jsonb_agg(jsonb_build_object(
        'brainrot_id',                  k.brainrot_id,
        'mutation_id',                  k.mutation_id,
        'calculated_income_per_second', k.calculated_income_per_second
      ) order by k.brainrot_id, k.mutation_id)
      from public.sab_brainrot_mutation_calculator k
    ), '[]'::jsonb)
  )
$$;

comment on function public.sab_reprice_reference() is
  'SAB reprice inputs: sab_public_price_catalog and sab_brainrot_mutation_calculator as one jsonb document, each view computed once.';

revoke all on function public.sab_reprice_reference() from public, anon, authenticated;
grant execute on function public.sab_reprice_reference() to service_role;
