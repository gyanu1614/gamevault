-- Step 1c · Fix 3a — seed the five global_categories rows.
--
-- global_categories was created by the baseline migration but never seeded
-- by one: the five rows were inserted on production by hand. A fresh
-- `supabase db reset` therefore left the table empty, and the seeder's
-- game_categories half silently skipped every game (Step 1 verification,
-- C10) until someone ran the DML by hand.
--
-- Values are the production rows verbatim, read on 2026-09-16 with a
-- read-only SELECT — ids included, because game_categories.global_category_id
-- is an ON DELETE RESTRICT foreign key to these ids. Nothing is invented.
--
-- Idempotent: on production every row already exists with these exact ids,
-- so this is a no-op there. Anywhere else it fills the table.
--
-- NOTE: `boosting` is is_active = false on production and is seeded that
-- way. The four active categories are what the seeder bridges.
--
-- NOTE: seo_title / seo_description carry retired brand copy ("GameVault",
-- "VaultShield escrow"). Seeded verbatim here so a fresh reset matches
-- production byte for byte; the copy is corrected in the next migration
-- so that both environments move together.

INSERT INTO public.global_categories
  (id, slug, name, description, icon_url, icon_emoji, sort_order, is_active, seo_title, seo_description, created_at, updated_at)
VALUES
  ('36cbbfba-2dff-4d19-a856-155a3accde26', 'currency', 'Currency', 'In-game currency (Robux, V-Bucks, gold, etc.)', NULL, '💰', 1, true, 'Buy & Sell Game Currency Safely | GameVault', 'Trade in-game currency across 30+ games with VaultShield escrow protection.', '2026-06-11T04:09:35.72584+00:00', '2026-06-11T04:09:35.72584+00:00'),
  ('8bd5554c-c597-4c92-a6d5-9b1d7dc60f14', 'items', 'Items', 'In-game items, pets, skins, fruits, knives, and more', NULL, '🎒', 2, true, 'Buy & Sell Game Items Safely | GameVault', 'Browse rare in-game items across the most popular titles.', '2026-06-11T04:09:35.72584+00:00', '2026-06-11T04:09:35.72584+00:00'),
  ('9683c14d-1280-4926-ba4d-5f2a317acbfa', 'accounts', 'Accounts', 'Game accounts with progression, skins, and stats', NULL, '👤', 3, true, 'Buy & Sell Game Accounts Safely | GameVault', 'Premium game accounts protected by escrow.', '2026-06-11T04:09:35.72584+00:00', '2026-06-11T04:09:35.72584+00:00'),
  ('52b4be97-e998-4aa6-8178-99cfb0075dd9', 'top-up', 'Top Up', 'Official top-ups (Genesis Crystals, UC, V-Bucks via Crew, etc.)', NULL, '⚡', 4, true, 'Game Top Up Service | GameVault', 'Top up your favorite games quickly and safely.', '2026-06-11T04:09:35.72584+00:00', '2026-06-11T04:09:35.72584+00:00'),
  ('79a3dca8-3d8c-4d78-a1fd-8a9f16f26467', 'boosting', 'Boosting', 'Rank, level, and achievement boosting services', NULL, '🚀', 5, false, 'Boosting Services | GameVault', 'Professional boosting services across competitive titles.', '2026-06-11T04:09:35.72584+00:00', '2026-06-11T04:09:35.72584+00:00')
ON CONFLICT (id) DO NOTHING;
