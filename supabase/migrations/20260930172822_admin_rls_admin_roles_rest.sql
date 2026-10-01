-- ============================================================================
-- Every remaining admin RLS policy reads admin_roles, never profiles.role
-- (follow-up to 20260930162255_admin_rls_admin_roles)
--
-- Problem (reproduced on a local stack 2026-09-30): 14 admin policies on 11
-- tables still asked
--   EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
--                                    AND profiles.role = ANY (ARRAY[...]))
--   · an active admin_roles admin whose profiles.role is 'user' could not read
--     inactive catalogue rows (templates, attributes, options, rules, global
--     categories), loyalty credits, promo usages or Trustpilot invitations,
--     nor write the catalogue from a session;
--   · the reverse: profiles.role = 'admin' with no admin_roles row read all of
--     those plus every seller's KYC documents and verification logs and every
--     admin notification, and could write the catalogue;
--   · admin_notifications also showed a row to its specific_admin_id with no
--     admin check, so a deactivated admin kept reading what was sent to them.
--
-- After — one check, get_admin_role() / is_admin() (SECURITY DEFINER, active
-- row only, EXECUTE for authenticated + service_role), every rewritten policy
-- TO authenticated (anon has no EXECUTE on get_admin_role(); an admin is
-- always signed in):
--   · REWRITTEN to active admin + super_admin — the roles the Games, Promo
--     Codes, Analytics and Fraud sidebar entries allow (same names as before):
--       attribute_conditional_rules / attribute_options / attribute_templates /
--       attributes / game_categories / global_categories  *_admin_all (ALL),
--       loyalty_credits_admin_select, trustpilot_invitations "Admins can view
--       all invitations";
--   · DROPPED where the table already has the admin_roles twin covering the
--     same role set, so the profiles.role copy only ever let extra people in
--     (same as "Admins can moderate reviews" in the first migration):
--       promo_code_usages_admin_select   ← promo_code_usages_admin_all
--                                          (active admin / super_admin);
--       seller_kyc_documents "Admins can view all KYC documents"
--                                        ← "Admins can view KYC documents"
--                                          (is_admin(): any active role — the
--                                          admin/moderator/support/super_admin
--                                          set the dropped one named);
--       seller_verification_logs "Admins can view all verification logs"
--                                        ← "Admins can view verification logs"
--                                          (is_admin(), same set);
--       admin_notifications "…for their role" (SELECT) + "…read status"
--       (UPDATE)                         ← "Admins can view their
--                                          notifications" (ALL, any active
--                                          admin_roles row — already a superset
--                                          of both for every active admin);
--   · DROPPED as dead: admin_action_logs "Admins can view action logs" —
--     anon/authenticated have had no privilege on the table since
--     20260928162611 (service-role only), so the policy never ran.
--
-- Nobody gains access: each population moves from a profiles.role value to
-- an active admin_roles row with the same role names, and no command changes.
-- Admin catalogue writes stay on the service role (admin-template-builder,
-- admin-game-wizard, admin-game-categories, admin-global-categories,
-- ensureGameCategory callers); the ALL policies only keep their old command.
-- The two listings policies on profiles.role = 'seller' are seller checks,
-- not admin gates, and stay.
--
-- Pinned by src/test/guards/admin-rls-admin-roles.guard.integration.test.ts.
-- ============================================================================

-- ── catalogue: active admin / super_admin ──────────────────────────────────
ALTER POLICY attribute_conditional_rules_admin_all ON public.attribute_conditional_rules
  TO authenticated
  USING ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'))
  WITH CHECK ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'));

ALTER POLICY attribute_options_admin_all ON public.attribute_options
  TO authenticated
  USING ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'))
  WITH CHECK ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'));

ALTER POLICY attribute_templates_admin_all ON public.attribute_templates
  TO authenticated
  USING ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'))
  WITH CHECK ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'));

ALTER POLICY attributes_admin_all ON public.attributes
  TO authenticated
  USING ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'))
  WITH CHECK ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'));

ALTER POLICY game_categories_admin_all ON public.game_categories
  TO authenticated
  USING ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'))
  WITH CHECK ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'));

ALTER POLICY global_categories_admin_all ON public.global_categories
  TO authenticated
  USING ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'))
  WITH CHECK ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'));

-- ── loyalty / Trustpilot: active admin / super_admin, read only ────────────
ALTER POLICY loyalty_credits_admin_select ON public.loyalty_credits
  TO authenticated
  USING ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'));

ALTER POLICY "Admins can view all invitations" ON public.trustpilot_invitations
  TO authenticated
  USING ((SELECT public.get_admin_role()) IN ('admin', 'super_admin'));

-- ── profiles.role duplicates of an existing admin_roles policy ─────────────
DROP POLICY promo_code_usages_admin_select ON public.promo_code_usages;
DROP POLICY "Admins can view all KYC documents" ON public.seller_kyc_documents;
DROP POLICY "Admins can view all verification logs" ON public.seller_verification_logs;
DROP POLICY "Admins can view notifications for their role" ON public.admin_notifications;
DROP POLICY "Admins can update notification read status" ON public.admin_notifications;

-- ── dead: no session privilege on the table ────────────────────────────────
DROP POLICY "Admins can view action logs" ON public.admin_action_logs;
