-- D1 test helpers — flip your seller policy states without remembering uuids.
-- Run blocks individually. Each block is independent.
--
-- Replace this email if yours is different. Everything below resolves the
-- uuid from this email.
--
--   gyanu1614@gmail.com

-- ─── A. Force the AMBER "needs review" banner ──────────────────────────────
-- Drops your tier to 'unverified'. Refresh /sell/new — banner turns amber.
-- Publishing lands the listing in pending_approval instead of active.

UPDATE public.profiles
SET seller_tier = 'unverified'
WHERE id = (SELECT id FROM public.profiles WHERE email = 'gyanu1614@gmail.com');


-- ─── B. Force the RED "at cap" banner ──────────────────────────────────────
-- Lowers the cap on your CURRENT tier to 1. If you already have >= 1 active
-- listing, refreshing /sell/new shows the red banner and disables Create
-- Offer. (Skip A first if you want to test this on your real tier.)

UPDATE public.seller_tier_config
SET listing_limit = 1
WHERE tier = (SELECT seller_tier FROM public.profiles
              WHERE email = 'gyanu1614@gmail.com');


-- ─── C. Restore everything to the defaults ─────────────────────────────────
-- Tier back to 'gold', cap back to 100. Run this after testing.

UPDATE public.profiles
SET seller_tier = 'gold'
WHERE id = (SELECT id FROM public.profiles WHERE email = 'gyanu1614@gmail.com');

UPDATE public.seller_tier_config
SET listing_limit = 100
WHERE tier = 'gold';
