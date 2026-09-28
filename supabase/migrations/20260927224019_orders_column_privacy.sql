-- ============================================================================
-- orders column privacy — the database withholds each party's private fields
--
-- Problem: the SELECT policies on orders ("Buyers and sellers can view their
-- orders", auth.uid() = buyer_id OR seller_id) return the WHOLE row to both
-- parties. Our pages drop the other side's fields (redactOrderFor, the
-- per-role column lists in seller-compatible.ts), but any signed-in party can
-- run supabase.from('orders').select('*') from the browser console and read:
--   · as the seller, the buyer's checkout_url, wallet_amount_used, promo,
--     buyer-side processing fees and provider payment ids;
--   · as the buyer, the seller's payout, commission snapshot / fee trace,
--     the platform's take and the transfer id.
-- Realtime postgres_changes payloads on orders carried the same whole row.
--
-- Model (column privileges are per DB role, not per row, so no single grant
-- can give the buyer a column and hide it from the seller):
--   1. anon + authenticated keep SELECT on the SHARED columns only. Postgres
--      then refuses (42501) '*', a private column, a filter or sort on one,
--      and an embed that reaches one — for every client path: PostgREST,
--      invoker views/functions, and Realtime (which drops columns the role
--      cannot select). New columns are private until granted here.
--      anon keeps the same list: RLS still gives it no rows, and a
--      selectable primary key keeps Realtime on its RLS path (the root-layout
--      purchase toast subscribes to orders for logged-out visitors).
--   2. Each party reads ITS OWN private fields through an auth.uid()-scoped
--      SECURITY DEFINER function (orders_seller_private / orders_buyer_private).
--   3. seller_dashboard_stats (security_invoker) summed orders.seller_payout
--      as the caller; its earnings columns now come from a definer helper
--      with the same row scope the RLS policies gave it.
-- The service role (money RPCs, crons, webhooks, admin actions after
-- requireAdmin) keeps table-level SELECT and is unaffected.
--
-- TS mirror: src/lib/orders/columns.ts (pinned by
-- src/test/guards/orders-column-privacy.guard.integration.test.ts).
-- ============================================================================

-- ── 1. column-level SELECT for the session roles ────────────────────────────
REVOKE SELECT ON public.orders FROM anon, authenticated;

GRANT SELECT (
  id, order_number, buyer_id, seller_id, listing_id,
  quantity, unit_price, subtotal, total_amount, currency,
  status, escrow_status, release_method, version,
  protection_until, auto_release_at, warranty_expires_at, chat_active_until,
  created_at, updated_at, paid_at, delivering_at, delivered_at, completed_at,
  cancelled_at, disputed_at, buyer_confirmed_at, seller_marked_delivered_at,
  payment_expires_at, confirm_reminder_sent_at, stock_claimed_at, stock_returned_at,
  delivery_details, dispute_reason,
  vaultshield_level, vaultshield_tier_fee, vaultshield_tier_fee_rate,
  delivery_evidence_required, delivery_evidence_urls,
  instant_delivery_code, instant_delivery_inventory_id, instant_delivery_delivered_at,
  is_guest_order, order_number_search
) ON public.orders TO anon, authenticated;

-- ── 2. each party's own private fields ──────────────────────────────────────
-- Only what that party's pages show; provider ids, the fee trace and the
-- transfer id stay service-role only.
CREATE OR REPLACE FUNCTION public.orders_seller_private(p_order_ids uuid[])
RETURNS TABLE (
  id uuid,
  seller_payout numeric,
  seller_commission_pct numeric,
  platform_fee numeric,
  platform_fee_rate numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.seller_payout, o.seller_commission_pct, o.platform_fee, o.platform_fee_rate
  FROM public.orders o
  WHERE o.id = ANY (p_order_ids)
    AND o.seller_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.orders_seller_private(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_seller_private(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.orders_buyer_private(p_order_ids uuid[])
RETURNS TABLE (
  id uuid,
  checkout_url text,
  payment_provider text,
  wallet_amount_used numeric,
  promo_discount numeric,
  payment_processing_fee numeric,
  buyer_fee_pct numeric,
  buyer_fee_amount numeric,
  buyer_fee_method text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.checkout_url, o.payment_provider, o.wallet_amount_used, o.promo_discount,
         o.payment_processing_fee, o.buyer_fee_pct, o.buyer_fee_amount, o.buyer_fee_method
  FROM public.orders o
  WHERE o.id = ANY (p_order_ids)
    AND o.buyer_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.orders_buyer_private(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_buyer_private(uuid[]) TO authenticated;

-- ── 3. seller_dashboard_stats earnings ──────────────────────────────────────
-- Same rows the invoker view summed before: the seller's own, every seller's
-- for an admin (the "Admins can view all orders" policy), all for the service
-- role / SQL editor; 0 for anyone else.
CREATE OR REPLACE FUNCTION public.seller_completed_payout_sum(p_seller_id uuid, p_since timestamptz)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(o.seller_payout), 0::numeric)
  FROM public.orders o
  WHERE o.seller_id = p_seller_id
    AND o.status = 'completed'
    AND (p_since IS NULL OR o.created_at >= p_since)
    AND (p_seller_id = auth.uid()
         OR public.is_admin()
         OR auth.role() = 'service_role'
         OR auth.role() IS NULL)
$$;
REVOKE ALL ON FUNCTION public.seller_completed_payout_sum(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_completed_payout_sum(uuid, timestamptz) TO authenticated;

-- Re-created from its live definition; only the four earnings columns change
-- (date(created_at) = CURRENT_DATE ⇔ created_at >= CURRENT_DATE for past rows).
CREATE OR REPLACE VIEW public.seller_dashboard_stats WITH (security_invoker = true) AS
 SELECT p.id AS seller_id,
    p.username,
    p.seller_tier,
    p.total_sales,
    p.seller_rating,
    ( SELECT count(*) AS count
           FROM public.listings
          WHERE ((listings.seller_id = p.id) AND (listings.status = 'active'::text))) AS active_listings,
    ( SELECT count(*) AS count
           FROM public.listings
          WHERE ((listings.seller_id = p.id) AND (listings.status = 'paused'::text))) AS paused_listings,
    ( SELECT count(*) AS count
           FROM public.listings
          WHERE ((listings.seller_id = p.id) AND (listings.status = 'draft'::text))) AS draft_listings,
    ( SELECT count(*) AS count
           FROM public.listings
          WHERE ((listings.seller_id = p.id) AND (listings.status = 'sold'::text))) AS sold_listings,
    ( SELECT count(*) AS count
           FROM public.orders
          WHERE ((orders.seller_id = p.id) AND (orders.status = 'pending'::text))) AS pending_orders,
    ( SELECT count(*) AS count
           FROM public.orders
          WHERE ((orders.seller_id = p.id) AND (orders.status = 'processing'::text))) AS processing_orders,
    ( SELECT count(*) AS count
           FROM public.orders
          WHERE ((orders.seller_id = p.id) AND (orders.status = 'completed'::text))) AS completed_orders,
    ( SELECT count(*) AS count
           FROM public.orders
          WHERE ((orders.seller_id = p.id) AND (orders.status = 'disputed'::text))) AS disputed_orders,
    ( SELECT COALESCE(sum(listings.views), (0)::bigint) AS "coalesce"
           FROM public.listings
          WHERE (listings.seller_id = p.id)) AS total_views,
    ( SELECT COALESCE(sum(listings.sales), (0)::bigint) AS "coalesce"
           FROM public.listings
          WHERE (listings.seller_id = p.id)) AS total_listing_sales,
    public.seller_completed_payout_sum(p.id, CURRENT_DATE::timestamptz) AS earnings_today,
    public.seller_completed_payout_sum(p.id, CURRENT_DATE - '7 days'::interval) AS earnings_week,
    public.seller_completed_payout_sum(p.id, CURRENT_DATE - '30 days'::interval) AS earnings_month,
    public.seller_completed_payout_sum(p.id, NULL) AS earnings_all_time
   FROM public.profiles p
  WHERE (p.seller_tier IS NOT NULL);
