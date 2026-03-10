-- Fix seller_applications_with_users view to include email
-- The view was missing the email column from profiles table

-- Drop the existing view first to avoid column order conflicts
DROP VIEW IF EXISTS seller_applications_with_users;

-- Recreate the view with email included
CREATE VIEW seller_applications_with_users AS
SELECT
  sa.*,
  p.username,
  p.full_name,
  p.email,
  p.avatar_url,
  (SELECT COUNT(*) FROM seller_kyc_documents WHERE application_id = sa.id) AS documents_count,
  (SELECT COUNT(*) FROM seller_kyc_documents WHERE application_id = sa.id AND verified = true) AS verified_documents_count
FROM seller_applications sa
JOIN profiles p ON sa.user_id = p.id;

COMMENT ON VIEW seller_applications_with_users IS 'View combining seller applications with user profile data including email';
