-- Catalogue items — the curated things the homepage features.
--
-- A listing is a seller's offer; a catalogue item is the THING itself. The
-- homepage needs the latter: it should show "Frost Dragon" with real artwork
-- and a clean name whether or not anyone is selling one right now, and it
-- shouldn't inherit a seller's free-text title or upload.
--
-- Prices are NOT stored here. They come from the cheapest active listing at
-- read time, so the catalogue can never advertise a stale number.

create table if not exists public.catalogue_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  game_id uuid not null references public.games (id) on delete cascade,

  name text not null,
  slug text not null,

  -- 'item' | 'currency'. Drives which card layout the row gets.
  kind text not null default 'item',

  -- Homepage feature slot, 1-8. NULL means "in the catalogue, not featured".
  featured_rank smallint,

  -- Curated artwork under /public. Distinct from listings.images, which is
  -- whatever the seller uploaded.
  image_path text,

  -- False until the artwork is a clean, transparent cutout. The homepage
  -- filters on this, so a placeholder or an unedited screenshot can sit in
  -- the table without reaching the front page.
  image_clean boolean not null default false,

  -- Currency only: how much one unit of this listing represents, and what to
  -- call it. 1000 + 'V-Bucks' renders as "1,000 / V-Bucks" with prices shown
  -- per 1K.
  unit_size integer,
  unit_label text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint catalogue_items_kind_check check (kind in ('item', 'currency')),
  constraint catalogue_items_rank_check check (
    featured_rank is null or (featured_rank between 1 and 8)
  ),
  -- Currency rows are meaningless without a unit.
  constraint catalogue_items_currency_unit_check check (
    kind <> 'currency' or (unit_size is not null and unit_label is not null)
  ),
  constraint catalogue_items_game_slug_key unique (game_id, slug)
);

-- One row per feature slot per kind, so two items can't claim rank 3.
create unique index if not exists catalogue_items_featured_rank_key
  on public.catalogue_items (kind, featured_rank)
  where featured_rank is not null;

create index if not exists catalogue_items_game_id_idx
  on public.catalogue_items (game_id);

comment on table public.catalogue_items is
  'Curated items and currencies. The homepage features these; prices are resolved from live listings at read time.';

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Catalogue rows are public reference data: anyone may read, only the
-- service role may write (admin tooling and migrations).
alter table public.catalogue_items enable row level security;

drop policy if exists "catalogue_items read" on public.catalogue_items;
create policy "catalogue_items read"
  on public.catalogue_items for select
  using (true);

-- ── Seed ─────────────────────────────────────────────────────────────────
-- image_clean stays FALSE for every row: no artwork exists yet. Each row
-- becomes eligible for the homepage the moment its PNG lands and the flag
-- is flipped.
--
-- Slugs corrected against the games table: counter-strike-2 -> cs2,
-- ea-fc-26 -> fc26, rainbow-six-siege -> r6-siege.
-- Row 1 rank 7 (blade-ball) is deliberately unassigned pending an item name.

insert into public.catalogue_items
  (game_id, name, slug, kind, featured_rank, image_path, unit_size, unit_label)
select g.id, v.name, v.slug, v.kind, v.featured_rank, v.image_path, v.unit_size, v.unit_label
from (values
  -- ROW 1 — items
  ('steal-a-brainrot', 'Garama and Madundung', 'garama-and-madundung', 'item', 1::smallint, '/items/steal-a-brainrot/garama-and-madundung.png', null::integer, null::text),
  ('adopt-me',         'Frost Dragon',         'frost-dragon',         'item', 2, '/items/adopt-me/frost-dragon.png',                 null, null),
  ('grow-a-garden-2',  'Unicorn',              'unicorn',              'item', 3, '/items/grow-a-garden-2/unicorn.png',               null, null),
  ('cs2',              'AK-47 | Redline (FT)', 'ak47-redline',         'item', 4, '/items/cs2/ak47-redline.png',                      null, null),
  ('murder-mystery-2', 'Harvester',            'harvester',            'item', 5, '/items/murder-mystery-2/harvester.png',            null, null),
  ('grow-a-garden',    'Raccoon',              'raccoon',              'item', 6, '/items/grow-a-garden/raccoon.png',                 null, null),
  ('cs2',              'AWP | Asiimov (FT)',   'awp-asiimov',          'item', 8, '/items/cs2/awp-asiimov.png',                       null, null),

  -- ROW 2 — currencies
  ('fortnite',        'V-Bucks',    'v-bucks',     'currency', 1, '/currency/v-bucks.png',     1000,    'V-Bucks'),
  ('roblox',          'Robux',      'robux',       'currency', 2, '/currency/robux.png',       1000,    'Robux'),
  ('valorant',        'VP',         'vp',          'currency', 3, '/currency/vp.png',          1000,    'VP'),
  ('grow-a-garden-2', 'Sheckles',   'sheckles',    'currency', 4, '/currency/sheckles.png',    1000000, 'Sheckles'),
  ('adopt-me',        'Bucks',      'bucks',       'currency', 5, '/currency/bucks.png',       10000,   'Bucks'),
  ('r6-siege',        'R6 Credits', 'r6-credits',  'currency', 6, '/currency/r6-credits.png',  1200,    'R6 Credits'),
  ('apex-legends',    'Apex Coins', 'apex-coins',  'currency', 7, '/currency/apex-coins.png',  1000,    'Apex Coins'),
  ('fc26',            'FC Points',  'fc-points',   'currency', 8, '/currency/fc-points.png',   1000,    'FC Points')
) as v(game_slug, name, slug, kind, featured_rank, image_path, unit_size, unit_label)
join public.games g on g.slug = v.game_slug
on conflict (game_id, slug) do nothing;
