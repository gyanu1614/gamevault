-- ════════════════════════════════════════════════════════════════════════
-- Fix: seller approval couldn't promote profiles.role
--
-- trg_prevent_privilege_escalation (20260219_master_rls_fix) reverts any
-- role/seller_tier/is_verified change unless public.is_admin() — which checks
-- admin_roles against auth.uid(). The approve action performs the profile
-- promotion with the SERVICE-ROLE client (no auth.uid()), so is_admin() was
-- false and the role write was SILENTLY reverted: applications flipped to
-- 'approved' while the seller stayed role='user' (no dashboard access, no
-- shop identity).
--
-- The service role bypasses RLS everywhere else by design — it is the
-- trusted backend context — so the escalation guard must let it through too.
-- The guard still fully protects end-user (authenticated/anon) updates.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trusted contexts may change anything: admins (session-authenticated)
  -- and the service-role backend (approve/moderation server actions).
  IF public.is_admin() OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- Normal users: preserve protected fields from OLD record
  NEW.role        := OLD.role;
  NEW.seller_tier := OLD.seller_tier;
  NEW.is_verified := COALESCE(OLD.is_verified, false);
  RETURN NEW;
END;
$$;

-- ── Data repair: promote every user whose application was approved but whose
--    profile promotion was silently reverted by the old trigger. ───────────
UPDATE profiles p
SET role = 'seller'
FROM seller_applications sa
WHERE sa.user_id = p.id
  AND sa.status = 'approved'
  AND p.role = 'user';
