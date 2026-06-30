-- V19/P24/P1 — Bundle currency support.
--
-- Adds `bundle_id` to listings so currency sellers can list against a
-- specific admin-defined bundle (e.g. "800 V-Bucks", "Fortnite Crew
-- 1 Month") instead of an arbitrary quantity.
--
-- Free-text reference to the bundle's id inside
-- category_configs.config.bundles[].id (JSONB). No FK — admin can
-- rename/reorder bundles without orphaning listings, and the buyer
-- page filters by string match. Trade-off: cheap to ship, defer
-- normalization until/if it matters.
--
-- Nullable: when a currency category is in flexible mode (no bundles
-- defined), bundle_id stays NULL and the listing behaves as today.

BEGIN;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS bundle_id text;

-- Composite index so the buyer-side bundle filter (game + bundle +
-- region + status) hits an index instead of scanning. Status filter
-- is already covered by other indexes; this one is targeted.
CREATE INDEX IF NOT EXISTS idx_listings_bundle_lookup
  ON public.listings (game_id, bundle_id, status)
  WHERE bundle_id IS NOT NULL;

COMMENT ON COLUMN public.listings.bundle_id IS
  'V19/P24 — When set, this listing is for a specific bundle defined in category_configs.config.bundles[].id. NULL means flexible-quantity currency or non-currency listing.';

COMMIT;
