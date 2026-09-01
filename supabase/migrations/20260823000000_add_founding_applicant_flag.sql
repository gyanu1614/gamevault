-- Founding-applicant routing flag.
--
-- Distinct from `profiles.founding_seller` (which is admin-granted and controls
-- the 2% fee discount). `is_founding_applicant` is a UI/routing signal only: it
-- means "this account's email is on the early_seller_signups waitlist", so we
-- show them the Founding HQ (menu entry + /early-seller redirect) instead of the
-- generic become-a-seller flow. It grants NO fee perk — that stays admin-gated.
--
-- Set when a founding signup matches an existing account, and backfilled here
-- for accounts that already exist (e.g. founders who signed up before this flag).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_founding_applicant boolean NOT NULL DEFAULT false;

-- Backfill: any account whose email matches a waitlist row becomes a founding
-- applicant. Case-insensitive match (emails are stored lowercased on both sides,
-- but ilike is belt-and-suspenders).
UPDATE public.profiles p
SET is_founding_applicant = true
WHERE p.is_founding_applicant = false
  AND EXISTS (
    SELECT 1
    FROM public.early_seller_signups s
    WHERE lower(s.email) = lower(p.email)
  );
