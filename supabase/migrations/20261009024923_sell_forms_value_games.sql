-- Sell-form fields that map an items listing to its values-catalogue row, so
-- the sell wizard's "Market Price" helper (growth point 30) and the listing →
-- value link read the PICKED item, not the title. Owner, 2026-10-08.
--
--   1. Steal a Brainrot  + optional "Mutation" (shown for Item Type = Brainrot).
--                          Not picked = the normal brainrot's price.
--   2. Murder Mystery 2  form rebuilt: Item Type (Knife / Gun / Pet) → one name
--                          list per type (option value = values_items.slug; a
--                          Chroma is its own row) + Rarity, auto-filled from
--                          the picked item (option metadata.sets, see
--                          src/lib/sell/option-sets.ts) so buyers can filter.
--                          The old fields (scrambled values: "pet" meant Knife;
--                          no item name) are retired. Live listings keep their
--                          stored template_data and value link.
--   3. Steal an Egg      new items form: Item Type → Area (random eggs, the
--                          bulk of the market) / Egg / Pet, + optional pet
--                          Mutation. Option values = values_items slugs.
--   4. Steal an Egg      catalogue: disable two junk rows (wiki template
--                          placeholders "{{{biome" and "Pets").
--
-- Data only: no functions, no grants. Every block looks the template up by
-- (game slug, category type) and does nothing when it is absent (local stacks
-- without these games), and is idempotent (ON CONFLICT / NOT EXISTS).
-- Matcher keys: src/lib/value-listings/catalogs.ts (select-brainrot-N,
-- select-knife/gun/pet, select-egg/select-pet/egg-area).

-- ── 1. Steal a Brainrot: Mutation ──────────────────────────────────────────
do $$
declare
  v_tpl  uuid;
  v_type uuid;
  v_attr uuid;
begin
  select t.id into v_tpl
  from public.attribute_templates t
  join public.game_categories gc on gc.id = t.game_category_id
  join public.games g on g.id = gc.game_id
  where g.slug = 'steal-a-brainrot' and gc.type = 'items';
  if v_tpl is null then return; end if;

  insert into public.attributes (template_id, slug, name, type, is_required, sort_order, facet_indexed, help_text)
  values (v_tpl, 'mutation', 'Mutation', 'select', false, 100, true, 'Leave empty for a normal brainrot.')
  on conflict (template_id, slug) do nothing;
  select id into v_attr from public.attributes where template_id = v_tpl and slug = 'mutation';

  insert into public.attribute_options (attribute_id, slug, value, label, sort_order)
  select v_attr, m.slug, m.slug, m.name, row_number() over (order by m.income_multiplier, m.name)
  from public.sab_mutations m
  where m.is_active and m.slug <> 'default'
  on conflict (attribute_id, slug) do nothing;

  select id into v_type from public.attributes where template_id = v_tpl and slug = 'item-type';
  if v_type is not null and not exists (
    select 1 from public.attribute_conditional_rules where attribute_id = v_attr
  ) then
    insert into public.attribute_conditional_rules (attribute_id, trigger_attribute_id, operator, trigger_values)
    values (v_attr, v_type, 'equals', '["brainrot"]'::jsonb);
  end if;
end $$;

-- ── 2. Murder Mystery 2: Item Type → name list per type (+ auto Rarity) ──────
do $$
declare
  v_tpl    uuid;
  v_game   uuid;
  v_type   uuid;
  v_rarity uuid;
  v_attr   uuid;
  r        record;
begin
  select t.id, g.id into v_tpl, v_game
  from public.attribute_templates t
  join public.game_categories gc on gc.id = t.game_category_id
  join public.games g on g.id = gc.game_id
  where g.slug = 'murder-mystery-2' and gc.type = 'items';
  if v_tpl is null then return; end if;

  -- Retire the old fields once (they have no item name to price from). The
  -- new ones are recognised by select-knife existing, so a re-run is a no-op.
  if not exists (select 1 from public.attributes where template_id = v_tpl and slug = 'select-knife') then
    delete from public.attributes
    where template_id = v_tpl and slug in ('item-type', 'rarity-2', 'rarity-3', 'rarity-4', 'special-type');
  end if;

  insert into public.attributes (template_id, slug, name, type, is_required, sort_order, facet_indexed)
  values (v_tpl, 'item-type', 'Item Type', 'select', true, 0, true)
  on conflict (template_id, slug) do nothing;
  select id into v_type from public.attributes where template_id = v_tpl and slug = 'item-type';
  insert into public.attribute_options (attribute_id, slug, value, label, sort_order)
  values (v_type, 'knife', 'knife', 'Knife', 1), (v_type, 'gun', 'gun', 'Gun', 2), (v_type, 'pet', 'pet', 'Pet', 3)
  on conflict (attribute_id, slug) do nothing;

  for r in select * from (values ('knife', 'Knife', 1), ('gun', 'Gun', 2), ('pet', 'Pet', 3)) as x(kind, label, ord) loop
    insert into public.attributes (template_id, slug, name, type, is_required, sort_order, facet_indexed, placeholder)
    values (v_tpl, 'select-' || r.kind, r.label, 'select', true, 1, true, 'Search ' || lower(r.label) || ' name')
    on conflict (template_id, slug) do nothing;
    select id into v_attr from public.attributes where template_id = v_tpl and slug = 'select-' || r.kind;

    insert into public.attribute_options (attribute_id, slug, value, label, metadata, sort_order)
    select
      v_attr, vi.slug, vi.slug, vi.name,
      case when vi.rarity is null then '{}'::jsonb
           else jsonb_build_object('sets', jsonb_build_object('rarity', lower(regexp_replace(vi.rarity, '[^A-Za-z0-9]+', '-', 'g'))))
      end,
      row_number() over (order by vi.name)
    from public.values_items vi
    where vi.game_id = v_game and vi.item_type = r.kind and vi.is_enabled
    on conflict (attribute_id, slug) do nothing;

    if not exists (select 1 from public.attribute_conditional_rules where attribute_id = v_attr) then
      insert into public.attribute_conditional_rules (attribute_id, trigger_attribute_id, operator, trigger_values)
      values (v_attr, v_type, 'equals', jsonb_build_array(r.kind));
    end if;
  end loop;

  insert into public.attributes (template_id, slug, name, type, is_required, sort_order, facet_indexed, help_text)
  values (v_tpl, 'rarity', 'Rarity', 'select', false, 2, true, 'Filled in from the item you pick.')
  on conflict (template_id, slug) do nothing;
  select id into v_rarity from public.attributes where template_id = v_tpl and slug = 'rarity';
  insert into public.attribute_options (attribute_id, slug, value, label, sort_order)
  select v_rarity, x.slug, x.slug, x.label, x.ord
  from (values
    ('common', 'Common', 1), ('uncommon', 'Uncommon', 2), ('rare', 'Rare', 3), ('legendary', 'Legendary', 4),
    ('vintage', 'Vintage', 5), ('godly', 'Godly', 6), ('ancient', 'Ancient', 7), ('unique', 'Unique', 8),
    ('chroma', 'Chroma', 9)
  ) as x(slug, label, ord)
  on conflict (attribute_id, slug) do nothing;
end $$;

-- ── 3. Steal an Egg: items form ─────────────────────────────────────────────
do $$
declare
  v_gc    uuid;
  v_game  uuid;
  v_tpl   uuid;
  v_type  uuid;
  v_area  uuid;
  v_egg   uuid;
  v_pet   uuid;
  v_mut   uuid;
begin
  select gc.id, g.id into v_gc, v_game
  from public.game_categories gc
  join public.games g on g.id = gc.game_id
  where g.slug = 'steal-an-egg' and gc.type = 'items';
  if v_gc is null then return; end if;

  -- 4. Junk catalogue rows (wiki template placeholders) never become options.
  update public.values_items
  set is_enabled = false
  where game_id = v_game and is_enabled and (name like '{{{%' or (kind = 'pet' and slug = 'pets'));

  insert into public.attribute_templates (game_category_id, name)
  values (v_gc, 'Steal an Egg — Items')
  on conflict (game_category_id) do nothing;
  select id into v_tpl from public.attribute_templates where game_category_id = v_gc;

  insert into public.attributes (template_id, slug, name, type, is_required, sort_order, facet_indexed)
  values (v_tpl, 'item-type', 'Item Type', 'select', true, 0, true)
  on conflict (template_id, slug) do nothing;
  select id into v_type from public.attributes where template_id = v_tpl and slug = 'item-type';
  insert into public.attribute_options (attribute_id, slug, value, label, sort_order)
  values
    (v_type, 'random-egg', 'random-egg', 'Random Egg (By Area)', 1),
    (v_type, 'named-egg', 'named-egg', 'Named Egg', 2),
    (v_type, 'pet', 'pet', 'Pet', 3),
    (v_type, 'other', 'other', 'Gamepass / Other', 4)
  on conflict (attribute_id, slug) do nothing;

  insert into public.attributes (template_id, slug, name, type, is_required, sort_order, facet_indexed)
  values
    (v_tpl, 'egg-area', 'Area', 'select', true, 1, true),
    (v_tpl, 'select-egg', 'Egg', 'select', true, 1, true),
    (v_tpl, 'select-pet', 'Pet', 'select', true, 1, true),
    (v_tpl, 'mutation', 'Mutation', 'select', false, 2, true)
  on conflict (template_id, slug) do nothing;
  select id into v_area from public.attributes where template_id = v_tpl and slug = 'egg-area';
  select id into v_egg  from public.attributes where template_id = v_tpl and slug = 'select-egg';
  select id into v_pet  from public.attributes where template_id = v_tpl and slug = 'select-pet';
  select id into v_mut  from public.attributes where template_id = v_tpl and slug = 'mutation';

  insert into public.attribute_options (attribute_id, slug, value, label, sort_order)
  select
    case vi.kind when 'area' then v_area when 'egg' then v_egg else v_pet end,
    vi.slug, vi.slug, vi.name,
    row_number() over (partition by vi.kind order by vi.name)
  from public.values_items vi
  where vi.game_id = v_game and vi.is_enabled and vi.kind in ('area', 'egg', 'pet')
  on conflict (attribute_id, slug) do nothing;

  insert into public.attribute_options (attribute_id, slug, value, label, sort_order)
  values
    (v_mut, 'silver', 'silver', 'Silver', 1),
    (v_mut, 'bloom', 'bloom', 'Bloom', 2),
    (v_mut, 'golden', 'golden', 'Golden', 3),
    (v_mut, 'rainbow', 'rainbow', 'Rainbow', 4),
    (v_mut, 'spirit-bloom', 'spirit-bloom', 'Spirit Bloom', 5),
    (v_mut, 'enchanted', 'enchanted', 'Enchanted', 6)
  on conflict (attribute_id, slug) do nothing;

  insert into public.attribute_conditional_rules (attribute_id, trigger_attribute_id, operator, trigger_values)
  select x.attr, v_type, 'equals', jsonb_build_array(x.val)
  from (values (v_area, 'random-egg'), (v_egg, 'named-egg'), (v_pet, 'pet'), (v_mut, 'pet')) as x(attr, val)
  where not exists (select 1 from public.attribute_conditional_rules c where c.attribute_id = x.attr);
end $$;
