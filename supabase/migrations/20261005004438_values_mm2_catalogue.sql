-- MM2 values hub, Step 1 (2026-10-04): catalogue columns for the generic
-- values_* pipeline + the Murder Mystery 2 config row.
--
-- Additive only: new nullable columns, one widened CHECK, one config row, one
-- public bucket. No existing row changes meaning; Steal an Egg is untouched
-- (every new column is NULL / '[]' for its rows).
--
-- values_items
--   item_type          MM2's own taxonomy (knife|gun|pet|misc|set). `kind`
--                      stays the page-component switch: MM2 weapons AND pets
--                      are kind='item' (they are all priced, unlike Steal an
--                      Egg's catalogue-only pets), sets are kind='bundle'.
--   base_item_id       a chroma row -> its base (chroma-fang -> fang). Chroma
--                      is a separate item with its own price, never a variant.
--   release_year       first year the item could be obtained (wiki).
--   origin             human label of where it came from ("Knife Box 2",
--                      "Halloween Event 2021").
--   obtain             structured how-to-get, an ARRAY of sources:
--                        { kind: box|event|pass|gamepass|crafting|code|unobtainable,
--                          name, year, cost: {amount, currency} | null,
--                          odds_pct, still_obtainable, wiki_page }
--   wiki_title         the Fandom page the row was imported from (the
--                      re-import key; CC-BY-SA source).
--   image_attribution  credit line for an image copied from the wiki.
--   how_to_get         the item page's verified "How To Get" facts, one
--                      object or NULL (no section): { status:
--                      obtainable|unobtainable|unknown|seasonal, method,
--                      costs?, odds?, released?, note?, sources[],
--                      confidence, checked_at }. Loaded by
--                      `pnpm values:mm2:how-to-get` from
--                      scripts/values-seeds/murder-mystery-2.how-to-get.json,
--                      so a re-check ships without a deploy. Separate from
--                      `obtain` (the raw wiki parse, whose still_obtainable
--                      flag is unreliable).
--   kind CHECK         += 'bundle' (MM2 sets, phase 2).
--
-- values_raw_listings
--   seller_ref         marketplace seller id (seller-concentration checks).
--   source_item_key    the marketplace's own stable product key
--                      (Eldorado standardizedProductKey "204|KNIFE|FANG|GODLY").
--   source_variant     the raw structured variant ("Common" | "Chroma").
--
-- Grants: values_items is already SELECT-able by anon/authenticated (table
-- grant + is_enabled RLS policy) — the new columns are public page data.
-- values_raw_listings and values_games stay service-role only (table posture
-- 20260921005842). No new function, so no EXECUTE grant to manage.

-- ── 1. values_items: catalogue columns ──────────────────────────────────────
alter table public.values_items
  add column if not exists item_type         text,
  add column if not exists base_item_id      uuid references public.values_items(id) on delete set null,
  add column if not exists release_year      smallint,
  add column if not exists origin            text,
  add column if not exists obtain            jsonb not null default '[]'::jsonb,
  add column if not exists wiki_title        text,
  add column if not exists image_attribution text,
  add column if not exists how_to_get        jsonb;

alter table public.values_items drop constraint if exists values_items_item_type_check;
alter table public.values_items add constraint values_items_item_type_check
  check (item_type is null or item_type in ('knife', 'gun', 'pet', 'misc', 'set'));

alter table public.values_items drop constraint if exists values_items_release_year_check;
alter table public.values_items add constraint values_items_release_year_check
  check (release_year is null or release_year between 2010 and 2100);

alter table public.values_items drop constraint if exists values_items_obtain_array_check;
alter table public.values_items add constraint values_items_obtain_array_check
  check (jsonb_typeof(obtain) = 'array');

alter table public.values_items drop constraint if exists values_items_how_to_get_object_check;
alter table public.values_items add constraint values_items_how_to_get_object_check
  check (how_to_get is null or jsonb_typeof(how_to_get) = 'object');

-- A row can never be its own base.
alter table public.values_items drop constraint if exists values_items_base_not_self_check;
alter table public.values_items add constraint values_items_base_not_self_check
  check (base_item_id is null or base_item_id <> id);

alter table public.values_items drop constraint if exists values_items_kind_check;
alter table public.values_items add constraint values_items_kind_check
  check (kind in ('egg', 'area', 'pet', 'item', 'account_bracket', 'bundle'));

create index if not exists values_items_base_item_idx
  on public.values_items (base_item_id) where base_item_id is not null;
create index if not exists values_items_game_type_idx
  on public.values_items (game_id, item_type) where is_enabled and item_type is not null;

-- ── 2. values_raw_listings: structured-source fields ────────────────────────
alter table public.values_raw_listings
  add column if not exists seller_ref      text,
  add column if not exists source_item_key text,
  add column if not exists source_variant  text;

create index if not exists values_raw_listings_item_key_idx
  on public.values_raw_listings (game_id, source_item_key)
  where source_item_key is not null;

-- ── 3. Murder Mystery 2 config row ──────────────────────────────────────────
-- Eldorado gameId 204; parsing config lives in code
-- (src/lib/values/sources/eldorado-structured-games.ts, keyed by game slug) and
-- a guard test pins `game_ref` here to that config. is_enabled = false until
-- the hub pages ship: the pricing job is gated separately (workflow variable).
-- No-op where the game row does not exist (a fresh local stack seeds games
-- after migrations: run `pnpm values:mm2:catalogue --write` there instead).
insert into public.values_games (game_id, sources, taxonomy_source, normaliser_key, refresh_minutes, is_enabled)
select g.id,
       '[{"source":"eldorado","game_ref":"204","enabled":true,"normaliser":"eldorado-structured"}]'::jsonb,
       '{"kind":"fandom","wiki":"murder-mystery-2","license":"CC-BY-SA-3.0","categories":["Weapons","Pets"]}'::jsonb,
       'eldorado-structured',
       1440,
       false
  from public.games g
 where g.slug = 'murder-mystery-2'
on conflict (game_id) do nothing;

-- ── 4. Public bucket for catalogue images copied from the wiki ──────────────
-- Served via /storage/v1/object/public/values-items/<game>/<slug>.<ext>.
-- Writes are service-role only (scripts/copy-values-images.mjs). The read
-- policy is what keeps the bucket's ACL reproducible from the repo (DLT-003,
-- storage-policies guard) — same shape as game-heroes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('values-items', 'values-items', true, 1048576,
        array['image/png', 'image/webp', 'image/jpeg', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists values_items_public_read on storage.objects;
create policy values_items_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'values-items');

-- ── 5. Proof ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'values_items' and column_name = 'obtain'
  ) then
    raise exception 'values_mm2_catalogue: values_items.obtain missing';
  end if;
  if has_table_privilege('anon', 'public.values_raw_listings', 'SELECT') then
    raise exception 'values_mm2_catalogue: values_raw_listings readable by anon';
  end if;
end $$;
