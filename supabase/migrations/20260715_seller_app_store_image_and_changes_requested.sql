-- =====================================================================
-- Seller-application store image + listings "changes_requested" status
-- =====================================================================
-- 1. seller_applications.profile_picture_path — the become-seller wizard
--    uploads a Store Image / Logo to the public `profile-pictures`
--    bucket and passes its path to the server action, but the column to
--    persist it never existed. Admin surfaces fell back to generated
--    avatars.
-- 2. Recreate seller_applications_with_users — the view snapshots
--    sa.* at creation time, so the new column only shows up after a
--    DROP + CREATE. Body is the 20260225 version, verbatim, plus
--    nothing else (column order preserved).
-- 3. listings_status_check — add 'changes_requested' (the Request
--    Changes moderation loop) and re-add 'rejected' (the reject_listing
--    RPC writes it, but the 20260208 constraint rewrite dropped it).
--
--    NOTE (run before applying in prod): verify the live constraint
--      SELECT pg_get_constraintdef(oid) FROM pg_constraint
--      WHERE conname = 'listings_status_check';
--    and make sure the CHECK below is a superset of every status the
--    live table already contains, or the ADD CONSTRAINT will fail.
-- 4. request_listing_changes RPC — SECURITY DEFINER sibling of
--    approve_listing / reject_listing so the admin cookie client can
--    flip a listing to changes_requested without RLS friction.
-- =====================================================================

BEGIN;

-- 1) Store image path on the application row
ALTER TABLE public.seller_applications
ADD COLUMN IF NOT EXISTS profile_picture_path text;

COMMENT ON COLUMN public.seller_applications.profile_picture_path IS
  'Storage path (profile-pictures bucket) of the store image/logo uploaded during the become-seller wizard';

-- 2) Recreate the admin view so sa.* picks up the new column
DROP VIEW IF EXISTS seller_applications_with_users;

CREATE VIEW seller_applications_with_users AS
SELECT
  sa.*,
  p.username,
  p.full_name,
  p.email,
  p.avatar_url,
  p.seller_status,
  p.seller_restriction_reason,
  p.seller_restricted_at,
  p.seller_restricted_by,
  (SELECT COUNT(*) FROM seller_kyc_documents WHERE application_id = sa.id) AS documents_count,
  (SELECT COUNT(*) FROM seller_kyc_documents WHERE application_id = sa.id AND verified = true) AS verified_documents_count
FROM seller_applications sa
JOIN profiles p ON sa.user_id = p.id;

COMMENT ON VIEW seller_applications_with_users IS 'View combining seller applications with user profile data including email and seller status';

-- 3) listings status constraint: union of every status the codebase
--    writes (draft/active/sold/archived/suspended/paused/
--    pending_approval from the 20260208 rewrite, 'rejected' from the
--    reject_listing RPC) + the new 'changes_requested'.
ALTER TABLE public.listings
DROP CONSTRAINT IF EXISTS listings_status_check;

ALTER TABLE public.listings
ADD CONSTRAINT listings_status_check
CHECK (status IN (
  'draft', 'active', 'sold', 'archived', 'suspended', 'paused',
  'pending_approval', 'rejected', 'changes_requested'
));

COMMENT ON CONSTRAINT listings_status_check ON public.listings IS
  'Valid listing statuses, incl. moderation loop states (pending_approval / changes_requested / rejected)';

-- 4) Request-changes RPC (parity with approve_listing / reject_listing)
CREATE OR REPLACE FUNCTION request_listing_changes(
  listing_id uuid,
  admin_id uuid,
  changes text
)
RETURNS void AS $$
BEGIN
  UPDATE public.listings
  SET
    status = 'changes_requested',
    moderation_notes = changes,
    approved_by = NULL,
    approved_at = NULL,
    updated_at = now()
  WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION request_listing_changes(uuid, uuid, text) TO authenticated;

COMMIT;
