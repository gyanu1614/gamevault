-- Widen Seller Tier History Checks. Idempotent.
--
-- profiles.seller_tier allows unverified|bronze|silver|gold|platinum|diamond,
-- but seller_tier_history's previous/new tier CHECKs only allow the middle
-- four — so recording the most common admin action (unverified → bronze)
-- would violate the constraint. Align history with the profile enum.

ALTER TABLE public.seller_tier_history
  DROP CONSTRAINT IF EXISTS seller_tier_history_previous_tier_check;
ALTER TABLE public.seller_tier_history
  DROP CONSTRAINT IF EXISTS seller_tier_history_new_tier_check;

ALTER TABLE public.seller_tier_history
  ADD CONSTRAINT seller_tier_history_previous_tier_check
  CHECK (previous_tier IS NULL OR previous_tier IN ('unverified','bronze','silver','gold','platinum','diamond'));
ALTER TABLE public.seller_tier_history
  ADD CONSTRAINT seller_tier_history_new_tier_check
  CHECK (new_tier IN ('unverified','bronze','silver','gold','platinum','diamond'));
