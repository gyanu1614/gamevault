-- /founding step 2 (owner, 2026-10-09): name, address, city and expected
-- monthly sales join country + games. Shown on the admin seller page.
ALTER TABLE public.seller_onboarding
  ADD COLUMN IF NOT EXISTS full_name       text CHECK (full_name IS NULL OR length(full_name) BETWEEN 2 AND 80),
  ADD COLUMN IF NOT EXISTS address_line    text CHECK (address_line IS NULL OR length(address_line) BETWEEN 3 AND 120),
  ADD COLUMN IF NOT EXISTS city            text CHECK (city IS NULL OR length(city) BETWEEN 2 AND 80),
  ADD COLUMN IF NOT EXISTS expected_volume text CHECK (expected_volume IS NULL OR expected_volume IN ('under_100', '100_500', '500_2000', '2000_plus'));
