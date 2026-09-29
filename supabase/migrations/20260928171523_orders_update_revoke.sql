-- ============================================================================
-- orders UPDATE — no session role holds it
--
-- Problem: anon + authenticated held table-level UPDATE on orders, and the
-- RLS policies "Buyers and sellers can update their orders", "Buyers can
-- confirm their orders" and "Sellers can update their orders" let either
-- party UPDATE their own row through PostgREST ("Admins can update all
-- orders" did the same for any admin session). guard_orders_protected_columns
-- (latest: 20260923185256) refuses the money / identity / status columns and
-- nothing else, so from the browser console:
--   · a seller could rewrite the buyer's checkout_url, payment_provider or
--     payment_expires_at on a pending order;
--   · a buyer could rewrite the provider / wallet mirrors
--     (provider_charge_id, stripe_*, wallet_amount_used, paid_at);
--   · either could forge delivering_at / seller_marked_delivered_at /
--     buyer_confirmed_at / delivery_details / delivery_evidence_urls /
--     instant_delivery_*, stretch warranty_expires_at / protection_until /
--     chat_active_until, move stock_* / cancelled_at, or bump version.
--
-- Inventory (2026-09-28):
--   · src/: the ONLY session-client UPDATE of orders was cancelOrder's
--     best-effort cancelled_at stamp (src/lib/actions/orders.ts) — redundant:
--     validate_order_status_transition sets cancelled_at when status flips
--     to 'cancelled', inside order_cancel_return_wallet's transaction. It is
--     removed in the same PR. Every other writer (escrow transition paid_at,
--     instant-delivery code, delivery proof urls, admin actions, crons,
--     webhooks) uses the service-role client.
--   · SQL: every function that UPDATEs orders is SECURITY DEFINER and
--     service_role-only (safedrop_transition, order_confirm_payment,
--     order_mark_delivering/_delivered[_in_dispute], order_confirm_receipt,
--     order_confirm_reminders_claim, order_dispute_open/_buyer_confirm,
--     inventory_claim_for_order, payment_attempt_open/_activate/_supersede,
--     release_with_reserve, and the definer trigger update_listing_quantity).
--     No invoker function, view or trigger writes orders as the session role.
--
-- So the column grant list for the session roles is EMPTY: REVOKE removes the
-- table privilege and, with it, UPDATE on every column. The party / admin
-- UPDATE policies are dropped too — they are dead without the privilege, and
-- a future column grant must come with its own deliberate policy instead of
-- inheriting "both parties may update the whole row".
--
-- SELECT is untouched: the column-level SELECT list from
-- 20260927224019_orders_column_privacy.sql (fix/orders-column-privacy) stays
-- exactly as that migration writes it; the two compose in either order.
-- The service role keeps table-level UPDATE; the guard trigger stays as the
-- second layer.
--
-- Pinned by src/test/guards/orders-update-grants.guard.integration.test.ts
-- (every column × buyer / seller / admin / anon → 42501 permission denied).
--
-- Rollback (restores the pre-migration posture exactly):
--   GRANT UPDATE ON public.orders TO anon, authenticated;
--   CREATE POLICY "Buyers and sellers can update their orders" ON public.orders
--     FOR UPDATE USING ((auth.uid() = buyer_id) OR (auth.uid() = seller_id));
--   CREATE POLICY "Buyers can confirm their orders" ON public.orders
--     FOR UPDATE USING (auth.uid() = buyer_id) WITH CHECK (auth.uid() = buyer_id);
--   CREATE POLICY "Sellers can update their orders" ON public.orders
--     FOR UPDATE USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
--   CREATE POLICY "Admins can update all orders" ON public.orders
--     FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
-- ============================================================================

REVOKE UPDATE ON public.orders FROM anon, authenticated;

DROP POLICY IF EXISTS "Buyers and sellers can update their orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can confirm their orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can update their orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
