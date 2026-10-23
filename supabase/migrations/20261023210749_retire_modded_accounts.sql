-- ─────────────────────────────────────────────────────────────────────────────
-- Retire the "Modded Accounts" sub-category (owner 2026-10-23).
--
-- GTA V had a separate /gta-v/buy-modded-accounts page next to its accounts
-- page. "Modded" reads as cheat-made, which the Prohibited Items policy bans,
-- and a payment-provider reviewer flags it. A game keeps ONE accounts page.
--
--   1. Listings on a modded-accounts pair move to the same game's accounts
--      pair (the sub-category's parent), when that pair exists and is on.
--   2. Every modded-accounts pair is switched off (is_enabled = false); the
--      pair rows stay, so past orders keep their category.
--   3. The global sub-category is retired (is_active = false), so neither the
--      admin wizard nor the game seeder creates the pair again.
--
-- No money is touched: an order's commission is fixed on the order when it
-- is placed, and GTA accounts carry the same rule on both pairs. Old URLs
-- redirect to the accounts page (next.config.js). The nightly
-- revalidate-listing-pages cron refreshes the moved listings' pages.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.listings l
   SET game_category_id = acc.id
  FROM public.game_categories modded
  JOIN public.global_categories g ON g.id = modded.global_category_id AND g.slug = 'modded-accounts'
  JOIN public.game_categories acc
    ON acc.game_id = modded.game_id
   AND acc.global_category_id = g.parent_id
   AND acc.is_enabled
 WHERE l.game_category_id = modded.id;

UPDATE public.game_categories gc
   SET is_enabled = false
  FROM public.global_categories g
 WHERE g.id = gc.global_category_id
   AND g.slug = 'modded-accounts'
   AND gc.is_enabled;

UPDATE public.global_categories
   SET is_active = false
 WHERE slug = 'modded-accounts'
   AND is_active;
