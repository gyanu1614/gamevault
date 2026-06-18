-- V17g — Canonicalize all category slugs to the SEO-optimized pattern.
--
-- After this migration runs, the DB holds the FINAL canonical slug for
-- every (game, category) pair. There are no aliases. Every URL the app
-- serves is the canonical URL — no 301 redirects, no flicker.
--
-- Pattern:
--   currency  → buy-{currency_name}    (e.g. buy-robux, buy-vbucks)
--   account   → buy-accounts
--   items     → buy-items
--   service   → boosting / coaching / servers (no "buy-" prefix; "buy
--               boosting" isn't a real search query, "WoW boosting" is)
--   top_up    → top-up
--
-- This SQL is idempotent — re-running it is a no-op once everything is
-- already canonical. It only touches rows where the current slug
-- differs from the target.

BEGIN;

-- ─── Roblox ───────────────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-robux'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'roblox')
  AND slug = 'robux';

UPDATE public.categories
SET slug = 'buy-items'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'roblox')
  AND slug = 'items';

UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'roblox')
  AND slug = 'accounts';

-- ─── Fortnite ─────────────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'fortnite')
  AND slug = 'accounts';

UPDATE public.categories
SET slug = 'buy-vbucks'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'fortnite')
  AND slug = 'vbucks';

UPDATE public.categories
SET slug = 'buy-skins'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'fortnite')
  AND slug = 'skins';

-- ─── Valorant ─────────────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'valorant')
  AND slug = 'accounts';

UPDATE public.categories
SET slug = 'buy-vp'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'valorant')
  AND slug = 'vp';

-- ─── GTA V ────────────────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'gta-v')
  AND slug = 'accounts';

UPDATE public.categories
SET slug = 'buy-gta-money'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'gta-v')
  AND slug = 'money';

UPDATE public.categories
SET slug = 'buy-modded-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'gta-v')
  AND slug = 'modded-accounts';

UPDATE public.categories
SET slug = 'buy-unlocks'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'gta-v')
  AND slug = 'unlocks';

-- ─── Minecraft ────────────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'minecraft')
  AND slug = 'accounts';

UPDATE public.categories
SET slug = 'buy-server-items'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'minecraft')
  AND slug = 'server-items';

UPDATE public.categories
SET slug = 'buy-minecoins'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'minecraft')
  AND slug = 'minecoins';

-- ─── League of Legends ────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'league-of-legends')
  AND slug = 'accounts';

UPDATE public.categories
SET slug = 'buy-rp'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'league-of-legends')
  AND slug = 'rp';

-- ─── CS2 ──────────────────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'cs2')
  AND slug = 'accounts';

UPDATE public.categories
SET slug = 'buy-items'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'cs2')
  AND slug = 'items';

-- ─── Genshin Impact ───────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'genshin-impact')
  AND slug = 'accounts';

UPDATE public.categories
SET slug = 'buy-items'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'genshin-impact')
  AND slug = 'items';

-- ─── PUBG Mobile ──────────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'pubg-mobile')
  AND slug = 'accounts';

UPDATE public.categories
SET slug = 'buy-items'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'pubg-mobile')
  AND slug = 'items';

-- ─── Free Fire ────────────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'free-fire')
  AND slug = 'accounts';

UPDATE public.categories
SET slug = 'buy-items'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'free-fire')
  AND slug = 'items';

-- ─── Mobile Legends ───────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'mobile-legends')
  AND slug = 'accounts';

-- ─── Apex Legends ─────────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'apex-legends')
  AND slug = 'accounts';

UPDATE public.categories
SET slug = 'buy-items'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'apex-legends')
  AND slug = 'items';

-- ─── Call of Duty ─────────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'call-of-duty')
  AND slug = 'accounts';

UPDATE public.categories
SET slug = 'buy-items'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'call-of-duty')
  AND slug = 'items';

-- ─── FC25 ─────────────────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-coins'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'fc25')
  AND slug = 'coins';

UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'fc25')
  AND slug = 'accounts';

UPDATE public.categories
SET slug = 'buy-items'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'fc25')
  AND slug = 'items';

-- ─── Escape from Tarkov ───────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-roubles'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'escape-from-tarkov')
  AND slug = 'currency';

UPDATE public.categories
SET slug = 'buy-items'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'escape-from-tarkov')
  AND slug = 'items';

UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'escape-from-tarkov')
  AND slug = 'accounts';

-- ─── R6 Siege ─────────────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'r6-siege')
  AND slug = 'accounts';

UPDATE public.categories
SET slug = 'buy-credits'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'r6-siege')
  AND slug = 'currency';

-- ─── Grow a Garden ────────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-items'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'grow-a-garden')
  AND slug = 'items';

UPDATE public.categories
SET slug = 'buy-sheckles'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'grow-a-garden')
  AND slug = 'currency';

UPDATE public.categories
SET slug = 'buy-accounts'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'grow-a-garden')
  AND slug = 'accounts';

-- ─── Steal a Brainrot ─────────────────────────────────────────────
UPDATE public.categories
SET slug = 'buy-items'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'steal-a-brainrot')
  AND slug = 'items';

UPDATE public.categories
SET slug = 'buy-cash'
WHERE game_id = (SELECT id FROM public.games WHERE slug = 'steal-a-brainrot')
  AND slug = 'currency';

COMMIT;
