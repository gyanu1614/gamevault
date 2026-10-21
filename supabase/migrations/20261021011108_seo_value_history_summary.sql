-- SEO value evidence: read history cheaply (2026-10-20 usage audit, C6).
--
-- seo_value_series returns every item's WHOLE price history as arrays and
-- refreshValueEvidence paged it with .range(): a set-returning SQL function is
-- re-run for every page, so each 1000-row page re-aggregated all three history
-- tables (Adopt Me ~6.4k series: ~7 full runs per call), 2-3 calls a day per
-- game, the output growing with every day stored.
--
-- What the gate needs on a normal run is two facts per item: how many days have
-- a price and the first priced day. The full series is needed only once, the
-- first time a page is evaluated (to replay its anchors).
--
--   seo_value_history_summary(source, game) -> jsonb array of
--     { item_slug, history_days, first_priced_day }        (one call)
--   seo_value_series_for(source, game, item_slugs[]) -> jsonb array of
--     { item_slug, series_key, days[], vals[] }            (new pages only)
--
-- jsonb scalars, so PostgREST's 1000-row cap does not apply. Same three
-- sources and filters as seo_value_series (kept: the pipeline guard tests it).

create or replace function public.seo_value_history_summary(p_source text, p_game_slug text)
returns jsonb
language sql
stable
set search_path = public
as $$
  with points as (
    select b.slug as item_slug, h.history_date as day, h.median_usd as value
    from sab_price_history h
    join sab_brainrots b on b.id = h.brainrot_id
    join sab_mutations m on m.id = h.mutation_id and m.slug = 'default'
    where p_source = 'sab'
    union all
    select p.slug, h.history_date, h.cash_value_usd
    from adopt_me_price_history h
    join adopt_me_pets p on p.id = h.pet_id
    where p_source = 'adopt-me' and h.is_estimated = false
    union all
    select i.slug, h.history_date, h.cheapest_usd
    from values_price_history h
    join values_items i on i.id = h.item_id
    join games g on g.id = i.game_id and g.slug = p_game_slug
    where p_source = 'pipeline'
  ),
  per_item as (
    select item_slug,
           count(distinct day) filter (where value is not null) as history_days,
           min(day) filter (where value is not null) as first_priced_day
    from points
    group by item_slug
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_slug', item_slug,
           'history_days', history_days,
           'first_priced_day', first_priced_day
         ) order by item_slug), '[]'::jsonb)
  from per_item
$$;

create or replace function public.seo_value_series_for(p_source text, p_game_slug text, p_item_slugs text[])
returns jsonb
language sql
stable
set search_path = public
as $$
  with series as (
    select b.slug as item_slug, ''::text as series_key,
           array_agg(h.history_date order by h.history_date) as days,
           array_agg(h.median_usd order by h.history_date) as vals
    from sab_price_history h
    join sab_brainrots b on b.id = h.brainrot_id
    join sab_mutations m on m.id = h.mutation_id and m.slug = 'default'
    where p_source = 'sab' and b.slug = any(p_item_slugs)
    group by b.slug
    union all
    select p.slug, h.variant,
           array_agg(h.history_date order by h.history_date),
           array_agg(h.cash_value_usd order by h.history_date)
    from adopt_me_price_history h
    join adopt_me_pets p on p.id = h.pet_id
    where p_source = 'adopt-me' and h.is_estimated = false and p.slug = any(p_item_slugs)
    group by p.slug, h.variant
    union all
    select i.slug, ''::text,
           array_agg(h.history_date order by h.history_date),
           array_agg(h.cheapest_usd order by h.history_date)
    from values_price_history h
    join values_items i on i.id = h.item_id
    join games g on g.id = i.game_id and g.slug = p_game_slug
    where p_source = 'pipeline' and i.slug = any(p_item_slugs)
    group by i.slug
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_slug', item_slug,
           'series_key', series_key,
           'days', to_jsonb(days),
           'vals', to_jsonb(vals)
         ) order by item_slug, series_key), '[]'::jsonb)
  from series
$$;

revoke all on function public.seo_value_history_summary(text, text) from public, anon, authenticated;
grant execute on function public.seo_value_history_summary(text, text) to service_role;
revoke all on function public.seo_value_series_for(text, text, text[]) from public, anon, authenticated;
grant execute on function public.seo_value_series_for(text, text, text[]) to service_role;
