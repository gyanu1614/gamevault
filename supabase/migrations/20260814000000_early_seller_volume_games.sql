-- Founding-seller waitlist: capture monthly volume band + games the applicant
-- sells. Powers the redesigned /early-seller form (forest split) and lets admins
-- prioritise concierge outreach by revenue band.
--
-- Both additive + nullable: existing rows and untagged/legacy signups stay valid.

ALTER TABLE public.early_seller_signups
  ADD COLUMN IF NOT EXISTS monthly_volume text,
  ADD COLUMN IF NOT EXISTS games text[];

COMMENT ON COLUMN public.early_seller_signups.monthly_volume IS
  'Self-reported monthly $ revenue band: one of ''0-500'', ''500-1k'', ''1k-5k'', ''5k+'' (free-text, capped in app). NULL = not provided.';

COMMENT ON COLUMN public.early_seller_signups.games IS
  'Games the applicant sells — an array of game slugs from the site catalog, plus any free-text "custom:<name>" entries. NULL/empty = not provided.';
