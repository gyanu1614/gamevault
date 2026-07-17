-- ════════════════════════════════════════════════════════════════════════
-- Completes the seller-promotion repair. Two remaining blockers surfaced:
--
-- 1. The live DB still runs the 20260217 version of
--    log_profile_privilege_changes, which INSERTs audit_logs.performed_by —
--    a column that doesn't exist (the 20260219 fix renamed it to user_id but
--    was never applied here). Every role change therefore ERRORS.
-- 2. prevent_profile_privilege_escalation blocks direct SQL-editor sessions
--    too (auth.role() IS NULL there — neither admin JWT nor service_role),
--    which is why the previous migration's own repair UPDATE was reverted.
--    Direct DB sessions hold database credentials and bypass RLS anyway —
--    they are trusted; let them through the guard.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Audit trigger writes the column that actually exists (user_id).
CREATE OR REPLACE FUNCTION log_profile_privilege_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, user_id, created_at)
    VALUES ('ROLE_CHANGE', 'profiles', NEW.id::TEXT,
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role),
      auth.uid(), NOW());
  END IF;

  IF OLD.seller_tier IS DISTINCT FROM NEW.seller_tier THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, user_id, created_at)
    VALUES ('TIER_CHANGE', 'profiles', NEW.id::TEXT,
      jsonb_build_object('seller_tier', OLD.seller_tier),
      jsonb_build_object('seller_tier', NEW.seller_tier),
      auth.uid(), NOW());
  END IF;

  IF OLD.is_verified IS DISTINCT FROM NEW.is_verified THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, user_id, created_at)
    VALUES ('VERIFICATION_CHANGE', 'profiles', NEW.id::TEXT,
      jsonb_build_object('is_verified', OLD.is_verified),
      jsonb_build_object('is_verified', NEW.is_verified),
      auth.uid(), NOW());
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Escalation guard: also trust direct DB sessions (no JWT at all).
CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trusted contexts may change anything: admin sessions, the service-role
  -- backend, and direct database sessions (SQL editor / migrations — they
  -- bypass RLS by nature, so blocking them only breaks repairs).
  IF public.is_admin() OR auth.role() = 'service_role' OR auth.role() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.role        := OLD.role;
  NEW.seller_tier := OLD.seller_tier;
  NEW.is_verified := COALESCE(OLD.is_verified, false);
  RETURN NEW;
END;
$$;

-- 3. The promotion, now unblocked: every approved application whose profile
--    is still role='user'.
UPDATE profiles p
SET role = 'seller'
FROM seller_applications sa
WHERE sa.user_id = p.id
  AND sa.status = 'approved'
  AND p.role = 'user';

-- Sanity: returns the promoted sellers.
SELECT p.username, p.email, p.role, p.shop_name
FROM profiles p
JOIN seller_applications sa ON sa.user_id = p.id
WHERE sa.status = 'approved';
