-- Grant admin access to specific users
-- Run this to add admin roles to users who need admin panel access

-- IMPORTANT: Replace the email addresses below with your actual admin users

-- Method 1: Grant by email (recommended)
INSERT INTO admin_roles (user_id, role, is_active, granted_at)
SELECT
  p.id,
  'super_admin'::admin_role_enum,
  true,
  NOW()
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email IN (
  'gyanu1614@gmail.com'  -- Replace with your admin email
  -- Add more emails as needed:
  -- ,'another-admin@example.com'
)
ON CONFLICT (user_id) DO UPDATE
  SET role = 'super_admin'::admin_role_enum,
      is_active = true,
      updated_at = NOW();

-- Verify the insert
SELECT
  p.email,
  p.username,
  ar.role,
  ar.is_active,
  ar.created_at
FROM admin_roles ar
JOIN profiles p ON ar.user_id = p.id
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'gyanu1614@gmail.com';
