-- Adopt Me eggs and potions on the Items page (owner, 2026-11-04). They are rows
-- in adopt_me_pets with is_active = false: every Values, calculator, sitemap, blog
-- and crawl reader filters is_active = true, so those surfaces stay pets-only.
-- item_kind says what the row is. The market catalogue reads with the anon key, so
-- the public read policy has to let these rows through; nothing about them is
-- private (a name and a picture).
alter table public.adopt_me_pets
  add column item_kind text check (item_kind in ('egg', 'potion'));

comment on column public.adopt_me_pets.item_kind is
  'Null for a pet. egg or potion: sold on the Items page only (is_active = false, no value page, no traits).';

drop policy "adopt_me_pets_public_read" on public.adopt_me_pets;

create policy "adopt_me_pets_public_read" on public.adopt_me_pets
  for select to anon, authenticated
  using (is_active = true or item_kind is not null);
