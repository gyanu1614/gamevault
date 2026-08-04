-- Founding-seller status (Phase 0 seller acquisition) — makes the "first 100
-- founding seller" perks REAL instead of marketing copy.
--
-- A founding seller gets a permanently reduced commission (their per-category
-- rate minus FOUNDING_DISCOUNT_PTS, floored at 0 — see src/lib/fees) and a
-- founding badge on their storefront. The flag is the single source of truth
-- for both the payout math (orders/checkout look it up per seller) and the
-- badge render. Purely additive: a false flag is exactly today's behaviour.
--
-- Granted MANUALLY by an admin (admin/active-sellers toggle → setFoundingSeller)
-- against a real seller profile. The /early-seller waitlist is triage only and
-- does not flip this flag — a waitlist row has no profiles.id yet.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS founding_seller boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.founding_seller IS
  'When true, this seller is a founding seller: they pay a permanently reduced commission (per-category rate minus FOUNDING_DISCOUNT_PTS, floored at 0 — src/lib/fees) and show a founding-seller badge. Granted manually by an admin via admin/active-sellers. Locked to the account for life.';

-- Partial index: the hot read is "is this seller founding?" at order-creation
-- time (a per-seller lookup) and the small set of founding sellers for badges.
-- Index only the true rows.
CREATE INDEX IF NOT EXISTS idx_profiles_founding_seller
  ON public.profiles (id)
  WHERE founding_seller = true;

COMMIT;
