-- ============================================================
-- P2.5 + P2.6: Security RLS Hardening
-- Created: 2026-02-17 | Fixed: 2026-02-18
-- ============================================================

-- ─── Step 0: Ensure is_verified column exists ─────────────
-- profiles table may not have this column yet

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.is_verified
  IS 'Whether this user has completed identity verification. Managed by admins only.';

-- ─── P2.5 — Self-Promotion Prevention ────────────────────────

-- Drop old permissive update policy on profiles if it exists
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON profiles;

-- Recreate: users can update their own profile BUT cannot
-- change role, seller_tier, or is_verified themselves.
CREATE POLICY "Users can update own profile (restricted)"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role        = (SELECT role        FROM profiles WHERE id = auth.uid())
    AND seller_tier = (SELECT seller_tier FROM profiles WHERE id = auth.uid())
    AND is_verified = (SELECT is_verified FROM profiles WHERE id = auth.uid())
  );

-- Ensure admins can still update any profile field freely
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  );

-- ─── P2.5 — Prevent Self-Role-Escalation via admin_roles ──────

DROP POLICY IF EXISTS "Admins can manage admin roles" ON admin_roles;
DROP POLICY IF EXISTS "Only super_admin can manage admin roles" ON admin_roles;

CREATE POLICY "Only super_admin can manage admin roles"
  ON admin_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles ar
      WHERE ar.user_id = auth.uid()
        AND ar.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_roles ar
      WHERE ar.user_id = auth.uid()
        AND ar.role = 'super_admin'
    )
    AND user_id != auth.uid()
  );

-- ─── P2.5 — Audit trigger: log role changes ──────────────────

CREATE OR REPLACE FUNCTION log_profile_privilege_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, performed_by, created_at)
    VALUES ('ROLE_CHANGE', 'profiles', NEW.id::TEXT,
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role),
      auth.uid(), NOW());
  END IF;

  IF OLD.seller_tier IS DISTINCT FROM NEW.seller_tier THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, performed_by, created_at)
    VALUES ('TIER_CHANGE', 'profiles', NEW.id::TEXT,
      jsonb_build_object('seller_tier', OLD.seller_tier),
      jsonb_build_object('seller_tier', NEW.seller_tier),
      auth.uid(), NOW());
  END IF;

  IF OLD.is_verified IS DISTINCT FROM NEW.is_verified THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, performed_by, created_at)
    VALUES ('VERIFICATION_CHANGE', 'profiles', NEW.id::TEXT,
      jsonb_build_object('is_verified', OLD.is_verified),
      jsonb_build_object('is_verified', NEW.is_verified),
      auth.uid(), NOW());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_profile_privilege_changes ON profiles;

CREATE TRIGGER trg_log_profile_privilege_changes
  AFTER UPDATE OF role, seller_tier, is_verified
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_profile_privilege_changes();

-- ─── P2.6 — Audit Log Immutability ───────────────────────────

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit logs are readable by admins" ON audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "No one can update audit logs" ON audit_logs;
DROP POLICY IF EXISTS "No one can delete audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin', 'moderator')
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No one can update audit logs"
  ON audit_logs FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No one can delete audit logs"
  ON audit_logs FOR DELETE TO authenticated
  USING (false);

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are immutable — modification of existing records is not permitted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_update ON audit_logs;
DROP TRIGGER IF EXISTS trg_prevent_audit_log_delete ON audit_logs;

CREATE TRIGGER trg_prevent_audit_log_update
  BEFORE UPDATE ON audit_logs FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER trg_prevent_audit_log_delete
  BEFORE DELETE ON audit_logs FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();
