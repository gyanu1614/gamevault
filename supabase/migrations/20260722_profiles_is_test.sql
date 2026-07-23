-- SEO Phase 1 (data hygiene) — mark test/demo accounts so their listings,
-- ratings and seller data never appear on public/indexable pages.
--
-- Source of truth is the ACCOUNT (a test user), not the individual listing:
-- test5/test7 etc. are test *sellers*, so one flag on the profile cleanly
-- excludes all of their listings from public queries via getTestSellerIds().
-- Does not touch marketplace logic — purely an additive filter dimension.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_test IS
  'When true, this account is a test/demo account: its listings, ratings and seller data are excluded from all public/indexable pages (browse, category, homepage, sitemap, schema). Set by admin or backfilled by username pattern.';

-- Backfill: flag obvious test accounts by username. Conservative pattern —
-- matches test/demo/dummy/sample prefixes and the known test buyer accounts.
-- Anchored so a real username merely CONTAINING "test" mid-word is less
-- likely to be caught; admins can toggle individuals afterwards.
UPDATE public.profiles
SET is_test = true
WHERE is_test = false
  AND (
    username ~* '^(test|demo|dummy|sample|logintest)'
    OR username ~* '^testbuyer'
    OR lower(username) = 'test'
  );

-- Partial index: public queries fetch the small set of test seller ids to
-- exclude, so index only the true rows (the hot path is `is_test = true`).
CREATE INDEX IF NOT EXISTS idx_profiles_is_test
  ON public.profiles (id)
  WHERE is_test = true;

COMMIT;
