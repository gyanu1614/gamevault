-- Seller-funnel attribution: record WHICH surface a founding-seller signup
-- came from (banner, footer, sab-calculator, a game's blog sell-guide, …).
--
-- The CTAs already carry a `?src=` tag in their /early-seller links; this
-- column is where submitEarlySeller persists it, so we can see which surface
-- actually produces signups (not just clicks). Nullable + free-text: an
-- untagged/direct visit is a legitimate NULL, and new surfaces don't need a
-- schema change. Purely additive — never shown publicly.

BEGIN;

ALTER TABLE public.early_seller_signups
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.early_seller_signups.source IS
  'Funnel attribution: the ?src= tag on the /early-seller link the signup came through (e.g. banner, footer, sab-calculator, steal-a-brainrot-blog-<slug>). NULL = direct/untagged. Free-text, capped in app code.';

COMMIT;
