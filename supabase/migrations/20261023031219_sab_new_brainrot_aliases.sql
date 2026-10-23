-- New brainrots get priced automatically (values catalogue follow-up, 2026-10-23).
--
-- Two gaps stopped a brainrot added by the daily catalogue job (or by hand)
-- from ever getting a price:
--
--   1. Eldorado listings are matched to brainrots ONLY through
--      sab_brainrot_aliases (sab_parse_market_title). That table was seeded
--      once for the brainrots that existed then; nothing added rows for new
--      ones, so their listings parsed as 'unmatched' (or under an older
--      brainrot whose shorter name is in the title).
--   2. sab_recompute_tradeable, run after every reprice, clears is_tradeable
--      for any brainrot without a reputable/trusted price or a popularity
--      rank — and the crawl skips non-tradeable rows. A new brainrot has
--      neither on day one, so after its first reprice it left the crawl for
--      good.
--
-- Fix:
--   * An AFTER INSERT trigger gives every new brainrot the same two aliases
--     the original seed used: its name (priority 100) and its slug with
--     spaces (90). Any insert path is covered, not just the catalogue.
--   * Brainrots added in the last 14 days stay tradeable, so the daily crawl
--     keeps looking for them while sellers start listing.
--   * One-off backfill: aliases for every brainrot that has none, re-parse
--     the recent raw listings against them, and recompute tradeable.

-- ── 1. Default aliases on insert ───────────────────────────────────────────
create or replace function public.sab_brainrot_default_aliases()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sab_brainrot_aliases (brainrot_id, alias, priority)
  values (new.id, new.name, 100), (new.id, replace(new.slug, '-', ' '), 90)
  on conflict on constraint sab_brainrot_aliases_brainrot_id_normalized_alias_key do nothing;
  return null;
end
$$;
comment on function public.sab_brainrot_default_aliases() is
  'AFTER INSERT on sab_brainrots: the name + slug aliases sab_parse_market_title matches Eldorado titles against.';
revoke all on function public.sab_brainrot_default_aliases() from public, anon, authenticated;

drop trigger if exists sab_brainrots_default_aliases on public.sab_brainrots;
create trigger sab_brainrots_default_aliases
  after insert on public.sab_brainrots
  for each row execute function public.sab_brainrot_default_aliases();

-- ── 2. A grace window for new brainrots ────────────────────────────────────
-- Body as 20261021011802 plus the created_at clause.
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
             -- New: keep crawling it while sellers start listing it.
             or b.created_at > now() - interval '14 days'
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
revoke all on function public.sab_recompute_tradeable() from public, anon, authenticated;
grant execute on function public.sab_recompute_tradeable() to service_role;

-- ── 3. Backfill the brainrots added before this trigger existed ────────────
insert into public.sab_brainrot_aliases (brainrot_id, alias, priority)
select b.id, v.alias, v.priority
from public.sab_brainrots b
cross join lateral (values (b.name, 100::smallint), (replace(b.slug, '-', ' '), 90::smallint)) as v(alias, priority)
where not exists (
  select 1 from public.sab_brainrot_aliases a where a.brainrot_id = b.id and a.is_active
)
on conflict on constraint sab_brainrot_aliases_brainrot_id_normalized_alias_key do nothing;

-- Re-match the listings already crawled for them (the newest 5,000 raw rows).
select * from public.sab_reparse_market_listings(5000);

-- Put the new ones back in the crawl.
select public.sab_recompute_tradeable();
