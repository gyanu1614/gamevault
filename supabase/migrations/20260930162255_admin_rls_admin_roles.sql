-- ============================================================================
-- Admin RLS on withdrawal_requests / withdrawal_methods / reviews reads
-- admin_roles, never profiles.role
--
-- Problem (reproduced on a local stack 2026-09-30): admin access is decided by
-- admin_roles (the (admin) layout, requireAdmin, is_admin()), but the baseline
-- admin policies on these tables still asked
--   EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
--                                    AND profiles.role = 'admin')
--   · an active admin_roles admin whose profiles.role is 'user' opened
--     /admin/withdrawals (getAllWithdrawalRequests, session client) and got an
--     EMPTY payout queue with no error — pending payouts looked cleared;
--   · the reverse: profiles.role = 'admin' with no admin_roles row read every
--     seller's withdrawal request and could UPDATE it;
--   · reviews also carried "Admins can manage all reviews" on admin_roles but
--     without is_active, so a deactivated admin kept full review access.
--
-- After — one check, get_admin_role() (SECURITY DEFINER, active row only,
-- EXECUTE for authenticated + service_role since 20260913100000), wrapped in
-- a scalar sub-select so it runs once per statement, not per row:
--   · withdrawal_requests SELECT + UPDATE, withdrawal_methods ALL: active
--     admin / super_admin — the roles the Withdrawals and Fees & Payouts
--     sidebar entries allow (moderator and support never saw payouts);
--   · reviews ALL: active super_admin / admin / moderator — the set the
--     admin_roles policy already named; the profiles.role duplicate is dropped;
--   · every policy is TO authenticated (was PUBLIC): anon has no EXECUTE on
--     get_admin_role(), and an admin is always signed in. Anon's own policies
--     ("Anyone can view visible reviews" / "active withdrawal methods") are
--     untouched.
-- Nobody gains access: the population moves from "profiles.role = 'admin'" to
-- "active admin_roles row with one of those roles", and no command changes.
-- Admin payout mutations stay on the service-role RPCs (withdrawal_approve /
-- _reject / _mark_paid); the UPDATE policy only keeps its old command.
--
-- get_admin_role() gets its search_path pinned (definer rule; body unchanged).
--
-- Pinned by src/test/guards/admin-rls-admin-roles.guard.integration.test.ts.
-- ============================================================================

ALTER FUNCTION public.get_admin_role() SET search_path = public;

-- ── withdrawal_requests ─────────────────────────────────────────────────────
ALTER POLICY "Admins can view all withdrawal requests" ON public.withdrawal_requests
  TO authenticated
  USING ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'));

ALTER POLICY "Admins can manage withdrawal requests" ON public.withdrawal_requests
  TO authenticated
  USING ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'))
  WITH CHECK ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'));

-- ── withdrawal_methods ──────────────────────────────────────────────────────
ALTER POLICY "Admins can manage withdrawal methods" ON public.withdrawal_methods
  TO authenticated
  USING ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'))
  WITH CHECK ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'));

-- ── reviews ─────────────────────────────────────────────────────────────────
DROP POLICY "Admins can moderate reviews" ON public.reviews;

ALTER POLICY "Admins can manage all reviews" ON public.reviews
  TO authenticated
  USING ((SELECT public.get_admin_role()) IN ('super_admin', 'admin', 'moderator'))
  WITH CHECK ((SELECT public.get_admin_role()) IN ('super_admin', 'admin', 'moderator'));

COMMENT ON POLICY "Admins can manage all reviews" ON public.reviews IS
  'Active super admins, admins and moderators (admin_roles) have full access to all reviews';
