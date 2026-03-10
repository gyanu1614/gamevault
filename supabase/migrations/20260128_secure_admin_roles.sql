-- ============================================
-- SECURE ADMIN ROLES MIGRATION
-- GameVault Phase 2 Security Upgrade
-- ============================================

-- ============================================
-- 1. CREATE ADMIN ROLE TYPE
-- ============================================

DO $$ BEGIN
  CREATE TYPE admin_role_enum AS ENUM ('super_admin', 'admin', 'moderator', 'support');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 2. ADMIN ROLES TABLE (Separate from profiles)
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role admin_role_enum NOT NULL,

  -- Security settings
  session_timeout_minutes INTEGER DEFAULT 30,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,

  -- Metadata
  is_active BOOLEAN DEFAULT true NOT NULL,
  granted_by UUID REFERENCES public.profiles(id),
  granted_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Activity tracking
  last_login_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  last_login_ip INET,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- CRITICAL: Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can only VIEW their own role
-- NO INSERT/UPDATE/DELETE policies = users cannot self-promote
CREATE POLICY "Users can view own admin role"
  ON admin_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Super admins can view all roles
CREATE POLICY "Super admins can view all roles"
  ON admin_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles ar
      WHERE ar.user_id = auth.uid()
      AND ar.role = 'super_admin'
      AND ar.is_active = true
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_roles_user_id ON admin_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_role ON admin_roles(role);
CREATE INDEX IF NOT EXISTS idx_admin_roles_active ON admin_roles(is_active) WHERE is_active = true;

-- ============================================
-- 3. ROLE PERMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  role admin_role_enum NOT NULL,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(role, permission)
);

-- Insert all permissions
INSERT INTO role_permissions (role, permission) VALUES
  -- Super Admin: All permissions
  ('super_admin', 'applications.view'),
  ('super_admin', 'applications.review'),
  ('super_admin', 'applications.approve'),
  ('super_admin', 'applications.reject'),
  ('super_admin', 'users.view'),
  ('super_admin', 'users.edit'),
  ('super_admin', 'users.suspend'),
  ('super_admin', 'users.ban'),
  ('super_admin', 'sellers.view'),
  ('super_admin', 'sellers.edit'),
  ('super_admin', 'sellers.suspend'),
  ('super_admin', 'sellers.change_tier'),
  ('super_admin', 'transactions.view'),
  ('super_admin', 'transactions.refund'),
  ('super_admin', 'disputes.view'),
  ('super_admin', 'disputes.assign'),
  ('super_admin', 'disputes.resolve'),
  ('super_admin', 'disputes.escalate'),
  ('super_admin', 'analytics.view'),
  ('super_admin', 'team.view'),
  ('super_admin', 'team.manage'),
  ('super_admin', 'settings.view'),
  ('super_admin', 'settings.edit'),
  ('super_admin', 'activity_log.view'),

  -- Admin: Most permissions except team management
  ('admin', 'applications.view'),
  ('admin', 'applications.review'),
  ('admin', 'applications.approve'),
  ('admin', 'applications.reject'),
  ('admin', 'users.view'),
  ('admin', 'users.edit'),
  ('admin', 'users.suspend'),
  ('admin', 'sellers.view'),
  ('admin', 'sellers.edit'),
  ('admin', 'sellers.suspend'),
  ('admin', 'sellers.change_tier'),
  ('admin', 'transactions.view'),
  ('admin', 'transactions.refund'),
  ('admin', 'disputes.view'),
  ('admin', 'disputes.assign'),
  ('admin', 'disputes.resolve'),
  ('admin', 'analytics.view'),
  ('admin', 'settings.view'),
  ('admin', 'activity_log.view'),

  -- Moderator: Review and basic management
  ('moderator', 'applications.view'),
  ('moderator', 'applications.review'),
  ('moderator', 'applications.approve'),
  ('moderator', 'applications.reject'),
  ('moderator', 'users.view'),
  ('moderator', 'users.suspend'),
  ('moderator', 'sellers.view'),
  ('moderator', 'sellers.suspend'),
  ('moderator', 'disputes.view'),
  ('moderator', 'disputes.resolve'),

  -- Support: View-only + dispute handling
  ('support', 'applications.view'),
  ('support', 'users.view'),
  ('support', 'sellers.view'),
  ('support', 'transactions.view'),
  ('support', 'disputes.view'),
  ('support', 'disputes.resolve')
ON CONFLICT (role, permission) DO NOTHING;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- 4. HELPER FUNCTIONS
-- ============================================

-- Check if current user is an admin (any role)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_roles
    WHERE user_id = auth.uid()
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has specific permission
CREATE OR REPLACE FUNCTION public.has_permission(required_permission TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM admin_roles ar
    JOIN role_permissions rp ON ar.role = rp.role
    WHERE ar.user_id = auth.uid()
    AND ar.is_active = true
    AND rp.permission = required_permission
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get user's admin role
CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS admin_role_enum AS $$
DECLARE
  user_role admin_role_enum;
BEGIN
  SELECT role INTO user_role
  FROM admin_roles
  WHERE user_id = auth.uid()
  AND is_active = true;
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get all permissions for current user
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TEXT[] AS $$
DECLARE
  perms TEXT[];
BEGIN
  SELECT ARRAY_AGG(rp.permission) INTO perms
  FROM admin_roles ar
  JOIN role_permissions rp ON ar.role = rp.role
  WHERE ar.user_id = auth.uid()
  AND ar.is_active = true;
  RETURN COALESCE(perms, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 5. UPDATE EXISTING RLS POLICIES
-- ============================================

-- Drop old policies that check profiles.role
DROP POLICY IF EXISTS "Admins can view all seller applications" ON seller_applications;
DROP POLICY IF EXISTS "Admins can update seller applications" ON seller_applications;
DROP POLICY IF EXISTS "Admins can view KYC documents" ON seller_kyc_documents;
DROP POLICY IF EXISTS "Admins can update KYC documents" ON seller_kyc_documents;
DROP POLICY IF EXISTS "Admins can view verification logs" ON seller_verification_logs;
DROP POLICY IF EXISTS "Admins can create verification logs" ON seller_verification_logs;

-- New policies using is_admin() function
CREATE POLICY "Admins can view all seller applications"
  ON seller_applications FOR SELECT
  TO authenticated
  USING (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "Admins can update seller applications"
  ON seller_applications FOR UPDATE
  TO authenticated
  USING (public.has_permission('applications.review'));

CREATE POLICY "Admins can view KYC documents"
  ON seller_kyc_documents FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM seller_applications sa
      WHERE sa.id = application_id AND sa.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update KYC documents"
  ON seller_kyc_documents FOR UPDATE
  TO authenticated
  USING (public.has_permission('applications.review'));

CREATE POLICY "Admins can view verification logs"
  ON seller_verification_logs FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM seller_applications sa
      WHERE sa.id = application_id AND sa.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create verification logs"
  ON seller_verification_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Storage policy for KYC documents
DROP POLICY IF EXISTS "Admins can read KYC documents" ON storage.objects;

CREATE POLICY "Admins can read KYC storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (
      public.is_admin() OR
      (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- ============================================
-- 6. MIGRATE EXISTING ADMIN (YOUR UUID)
-- ============================================

INSERT INTO admin_roles (user_id, role, is_active, granted_by)
VALUES ('66e508c1-6131-4761-823f-4d3efdc199d7', 'super_admin', true, NULL)
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin', is_active = true;

-- ============================================
-- 7. TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_admin_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_admin_roles_updated_at ON admin_roles;
CREATE TRIGGER update_admin_roles_updated_at
  BEFORE UPDATE ON admin_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_roles_updated_at();
