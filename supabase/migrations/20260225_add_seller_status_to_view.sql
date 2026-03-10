-- Add seller_status fields to seller_applications_with_users view
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
