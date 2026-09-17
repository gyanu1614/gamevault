-- Step 1c · Fix 3b — correct retired brand copy on global_categories.
--
-- The five rows seeded by the previous migration (verbatim from production)
-- carry seo_title / seo_description written before the rebrand: "GameVault"
-- is the retired name, and "VaultShield escrow protection" / "protected by
-- escrow" is retired language — DropMarket is a commercial agent, never an
-- escrow, and no user-facing copy may say it holds funds. SafeDrop is the
-- current name for the buyer guarantee, referenced wherever the old copy
-- referenced VaultShield.
--
-- Nothing renders these two columns today (the only wide read is an
-- admin-side SELECT *), so this is a data correction, not a visible change.
-- It is a migration rather than one-off DML so production and every fresh
-- reset move together.
--
-- Keyed by slug (UNIQUE), not id, so it also corrects any environment whose
-- rows predate the id-pinned seed. Idempotent: re-running sets the same
-- values. updated_at is bumped so the change is visible in the row.

UPDATE public.global_categories SET
  seo_title       = 'Buy & Sell Game Currency Safely | DropMarket',
  seo_description = 'Trade in-game currency across 30+ games with SafeDrop — item guaranteed or full refund.',
  updated_at      = now()
WHERE slug = 'currency';

UPDATE public.global_categories SET
  seo_title       = 'Buy & Sell Game Items Safely | DropMarket',
  seo_description = 'Browse rare in-game items across the most popular titles.',
  updated_at      = now()
WHERE slug = 'items';

UPDATE public.global_categories SET
  seo_title       = 'Buy & Sell Game Accounts Safely | DropMarket',
  seo_description = 'Premium game accounts backed by SafeDrop — item guaranteed or full refund.',
  updated_at      = now()
WHERE slug = 'accounts';

UPDATE public.global_categories SET
  seo_title       = 'Game Top Up Service | DropMarket',
  seo_description = 'Top up your favorite games quickly and safely.',
  updated_at      = now()
WHERE slug = 'top-up';

UPDATE public.global_categories SET
  seo_title       = 'Boosting Services | DropMarket',
  seo_description = 'Professional boosting services across competitive titles.',
  updated_at      = now()
WHERE slug = 'boosting';
