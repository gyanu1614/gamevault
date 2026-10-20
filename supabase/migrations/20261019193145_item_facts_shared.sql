-- Shared item facts for every value item page (SEO Phase 2, 2026-10-19).
--
-- One fact set for every game: when an item came out, where it came from, and
-- its verified "How To Get" entry. values_items already has all three
-- (20261005004438_values_mm2_catalogue); this adds the missing ones to the two
-- games with their own item tables, with the same checks:
--
--   sab_brainrots.released_at   the day it came out: the date of the update
--                               that added it (the wiki's Update Log), so a
--                               date like Adopt Me's, not just a year.
--   sab_brainrots.origin        where it comes from ("Red Carpet", "Admin
--                               Lucky Block", "Los Taco Blocks").
--   sab_brainrots.how_to_get    the item page's verified How To Get facts.
--   adopt_me_pets.how_to_get    same. Adopt Me already stores the release
--                               (released_at) and origin (origin_detail);
--                               those are reused, not duplicated.
--
-- how_to_get is one object or NULL (no section): { status:
-- obtainable|unobtainable|unknown|seasonal, method, costs?, odds?, released?,
-- note?, sources[], confidence, checked_at }, parsed by parseHowToGet
-- (src/lib/values/how-to-get.ts). Data is filled by the per-game importers
-- (Phase 3); until then every value is NULL and pages render as before.
--
-- Additive and nullable: no backfill, no lock beyond the catalogue tables'
-- brief ALTER. Read by the public pages through the existing table SELECT
-- grants and RLS (active / reviewed rows only) — no new grant.

alter table public.sab_brainrots
  add column if not exists released_at date,
  add column if not exists origin      text,
  add column if not exists how_to_get  jsonb;

alter table public.sab_brainrots drop constraint if exists sab_brainrots_released_at_check;
alter table public.sab_brainrots add constraint sab_brainrots_released_at_check
  check (released_at is null or released_at between date '2010-01-01' and date '2100-12-31');

alter table public.sab_brainrots drop constraint if exists sab_brainrots_how_to_get_object_check;
alter table public.sab_brainrots add constraint sab_brainrots_how_to_get_object_check
  check (how_to_get is null or jsonb_typeof(how_to_get) = 'object');

alter table public.adopt_me_pets
  add column if not exists how_to_get jsonb;

alter table public.adopt_me_pets drop constraint if exists adopt_me_pets_how_to_get_object_check;
alter table public.adopt_me_pets add constraint adopt_me_pets_how_to_get_object_check
  check (how_to_get is null or jsonb_typeof(how_to_get) = 'object');

comment on column public.sab_brainrots.released_at is 'Day the brainrot came out (its update''s date, wiki Update Log). Shared item fact.';
comment on column public.sab_brainrots.origin is 'Where the brainrot came from, as a name. Shared item fact.';
comment on column public.sab_brainrots.how_to_get is 'Verified How To Get facts for the item page (parseHowToGet), or NULL for no section.';
comment on column public.adopt_me_pets.how_to_get is 'Verified How To Get facts for the pet page (parseHowToGet), or NULL for no section.';
