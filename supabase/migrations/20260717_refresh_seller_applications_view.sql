-- Refresh seller_applications_with_users: `sa.*` in a view captures columns
-- at CREATE time, so the columns added by the seller-application redesign
-- (games_categories, selling_experience, payout_currency, seller_signature,
-- seller_signed_at, shop_name, crypto_type, …) were invisible to the admin
-- list, which reads this view. Recreating with the identical definition
-- re-expands sa.* to the current table shape.

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

-- Admin surfaces read this via server-side clients; keep parity with the
-- prior grants (view inherits RLS of underlying tables for definer contexts).
GRANT SELECT ON seller_applications_with_users TO authenticated, service_role;
