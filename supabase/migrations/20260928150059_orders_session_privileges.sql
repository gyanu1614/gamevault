-- ============================================================================
-- orders: the session roles keep only what they use
--
-- Problem: anon + authenticated still held the Supabase default table grant
-- on orders — INSERT, DELETE, TRUNCATE, TRIGGER, REFERENCES (UPDATE is
-- 20260928142017_orders_update_revoke; SELECT was made column-level by
-- 20260927224019_orders_column_privacy). Row security was the only barrier,
-- and not everywhere:
--   · DELETE: "Admins can delete orders" let any admin SESSION hard-delete an
--     order through PostgREST — no audit row, no money seam. The FKs then
--     CASCADE away its conversation, reviews, dispute events, cancellation
--     requests and payment attempts, and SET NULL the order on payouts,
--     loyalty_credits, referral_earnings, promo_code_usages and sold
--     instant_delivery_inventory. No admin action deletes orders.
--   · INSERT: no INSERT policy exists, and a session insert currently fails
--     only because the order_number default calls generate_order_number(),
--     which is service_role-only — an accident, not a rule.
--   · TRUNCATE ignores RLS; TRIGGER / REFERENCES are DDL-side privileges no
--     session needs (neither role can CREATE in public today).
-- seller_dashboard_stats (security_invoker, read by getDashboardStats) is
-- auto-updatable over profiles (seller_id, username, seller_tier,
-- total_sales, seller_rating) and authenticated held INSERT / UPDATE /
-- DELETE on it: a second write path into profiles beside the table's own.
-- The profiles policies + guards (guard_profiles_protected_columns,
-- prevent_profile_privilege_escalation) still applied, so nothing beyond a
-- direct profiles update was reachable — but a dashboard view is read-only.
--
-- Inventory (2026-09-28):
--   · src/: no client inserts, deletes or upserts orders; checkout creates
--     them through order_create_pending (service role). The app only
--     SELECTs seller_dashboard_stats. Realtime subscriptions need SELECT.
--   · SQL: the only function that INSERTs orders is order_create_pending
--     (SECURITY DEFINER, service_role-only); none DELETEs or TRUNCATEs it.
--     FK referential actions run as the table owner, so cascades are
--     unaffected.
--
-- After this migration and 20260928142017, the session roles hold exactly
-- the column-level SELECT list of 20260927224019 on orders (untouched here).
-- The service role keeps every privilege.
--
-- Note: a DROP + CREATE of seller_dashboard_stats would re-grant ALL through
-- the schema's default privileges; CREATE OR REPLACE keeps these grants.
--
-- Pinned by src/test/guards/orders-session-privileges.guard.integration.test.ts.
--
-- Rollback (restores the pre-migration posture exactly):
--   GRANT INSERT, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.orders TO anon, authenticated;
--   CREATE POLICY "Admins can delete orders" ON public.orders
--     FOR DELETE TO authenticated USING (public.is_admin());
--   GRANT INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
--     ON public.seller_dashboard_stats TO authenticated;
-- ============================================================================

REVOKE INSERT, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.orders FROM anon, authenticated;

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.seller_dashboard_stats FROM anon, authenticated;
