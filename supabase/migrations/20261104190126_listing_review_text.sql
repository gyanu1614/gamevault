-- What staff write about a listing never stays on a public row (plan 2, phase 1).
--
-- `listings` is granted to the public key and protected only by row rules, so every column of an
-- active listing can be read by anyone. moderation_notes and rejection_reason were being left in
-- place after approval: on 2026-11-04, 8 live listings carried staff comments such as "Set a
-- better price" that the public key could read.
--
-- A column grant would not close this, because the table-wide SELECT grant wins and many readers
-- rely on it. So the text simply does not exist on a live row: a trigger clears it on every path
-- to `active`. It has no column list because on_listing_quantity_change turns a sold listing active
-- on a quantity-only update, and it sorts after that trigger so it sees the new status.
--
-- While a listing is not live, only its seller, staff and buyers who ordered it can read the row,
-- which is what lets the seller see why it was refused.
--
-- The seller has already had this text by email, and the audit log keeps it (moderation.ts passes
-- it as `notes` on each decision), so clearing the 8 existing rows loses nothing staff rely on.

CREATE OR REPLACE FUNCTION public.listings_clear_review_text() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  NEW.moderation_notes := NULL;
  NEW.rejection_reason := NULL;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.listings_clear_review_text() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_listings_clear_review_text ON public.listings;
CREATE TRIGGER trg_listings_clear_review_text
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION public.listings_clear_review_text();

UPDATE public.listings
SET moderation_notes = NULL, rejection_reason = NULL
WHERE status = 'active' AND (moderation_notes IS NOT NULL OR rejection_reason IS NOT NULL);
