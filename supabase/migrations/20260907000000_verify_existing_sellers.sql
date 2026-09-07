-- Backfill is_verified for existing sellers.
--
-- Every approved seller has passed KYC, but `profiles.is_verified` was never set
-- by the approval flow (only a dev fixture ever set it) — so the blue "Verified"
-- badge, which now keys purely on is_verified, showed for nobody. Approval now
-- sets is_verified=true going forward (admin-seller-review); this backfills the
-- sellers already approved before that change.
--
-- Scope: role='seller' only. Buyers are untouched. Idempotent.

UPDATE public.profiles
SET is_verified = true
WHERE role = 'seller'
  AND is_verified IS DISTINCT FROM true;
