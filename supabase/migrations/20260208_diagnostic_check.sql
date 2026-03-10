-- Diagnostic query to check seller account and listings
-- Run this to see what's happening with test7@gmail.com

-- Check the seller profile
SELECT
  id,
  email,
  username,
  role,
  seller_tier,
  total_sales,
  created_at
FROM profiles
WHERE email = 'test7@gmail.com';

-- Check listings for this seller
SELECT
  l.id,
  l.title,
  l.status,
  l.seller_id,
  l.created_at,
  p.email as seller_email,
  p.role as seller_role,
  p.seller_tier
FROM listings l
JOIN profiles p ON p.id = l.seller_id
WHERE p.email = 'test7@gmail.com'
ORDER BY l.created_at DESC;

-- Check if admin_roles table has your admin user
SELECT
  ar.user_id,
  ar.role,
  ar.is_active,
  p.email
FROM admin_roles ar
JOIN auth.users u ON u.id = ar.user_id
LEFT JOIN profiles p ON p.id = ar.user_id
WHERE ar.is_active = true;
