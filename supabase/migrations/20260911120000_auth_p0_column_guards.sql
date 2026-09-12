-- ============================================================================
-- AUTH-002 / AUTH-005 / AUTH-006 — column guards (audit 2026-09-11, hotfix/auth-p0)
--
-- Problem: the UPDATE policies on orders / profiles / listings re-assert row
-- ownership but not columns, so a user with the public anon key and their own
-- JWT can rewrite ANY column of their own row through PostgREST — including
-- orders.seller_payout (credited verbatim by release_with_reserve /
-- safedrop_transition), profiles.seller_status (trusted by the middleware ban
-- gate), and listings.approved_by (short-circuits check_listing_moderation).
-- Verified live on 2026-09-11 with throwaway users: all three succeeded.
--
-- Model: ONE BEFORE UPDATE trigger per table rejects (SQLSTATE 42501) any change
-- to a protected column unless the write is trusted:
--   · auth.role() = 'service_role'                  — the backend
--   · auth.role() IS NULL                           — SQL editor / migrations
--   · current_setting('app.guarded_write') = 'on'   — an explicit, transaction-
--     local flag that every SQL function which legitimately writes protected
--     columns sets as its FIRST statement (listed below). No is_admin() shortcut:
--     admin app paths that wrote these columns via the session client were moved
--     to the service role in the same hotfix.
--
-- Flagged functions (re-created verbatim from their latest definition):
--   · approve_listing                    (20260903010000_lock_moderation_rpcs.sql)
--   · reject_listing                     (20260903010000_lock_moderation_rpcs.sql)
--   · request_listing_changes            (20260903010000_lock_moderation_rpcs.sql)
--   · update_listing_quantity            (20260101000000_baseline_live_schema.sql)
--   · update_seller_rating               (20260101000000_baseline_live_schema.sql)
--   · release_escrow_to_seller_balance   (20260101000000_baseline_live_schema.sql)
--   · release_with_reserve               (20260101000000_baseline_live_schema.sql)
--   · safedrop_transition                (20260101000000_baseline_live_schema.sql)
--   · freeze_escrow                      (20260101000000_baseline_live_schema.sql)
--   · refund_escrow                      (20260101000000_baseline_live_schema.sql)
--   · release_escrow                     (20260101000000_baseline_live_schema.sql)
-- ============================================================================

-- ── trust check ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guarded_write_allowed() RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT auth.role() = 'service_role'
      OR auth.role() IS NULL
      OR COALESCE(current_setting('app.guarded_write', true), '') = 'on'
$$;
REVOKE ALL ON FUNCTION public.guarded_write_allowed() FROM PUBLIC, anon, authenticated;

-- Probe for integration tests: present ⇒ this migration is applied.
CREATE OR REPLACE FUNCTION public.auth_p0_guards_version() RETURNS integer
  LANGUAGE sql IMMUTABLE AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.auth_p0_guards_version() FROM PUBLIC, anon, authenticated;

-- ── orders: BEFORE UPDATE guard ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_orders_protected_columns() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changed text[] := '{}';
BEGIN
  IF public.guarded_write_allowed() THEN
    RETURN NEW;
  END IF;
  IF NEW.seller_payout IS DISTINCT FROM OLD.seller_payout THEN changed := array_append(changed, 'seller_payout'); END IF;
  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN changed := array_append(changed, 'total_amount'); END IF;
  IF NEW.subtotal IS DISTINCT FROM OLD.subtotal THEN changed := array_append(changed, 'subtotal'); END IF;
  IF NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN changed := array_append(changed, 'unit_price'); END IF;
  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN changed := array_append(changed, 'quantity'); END IF;
  IF NEW.platform_fee IS DISTINCT FROM OLD.platform_fee THEN changed := array_append(changed, 'platform_fee'); END IF;
  IF NEW.platform_fee_rate IS DISTINCT FROM OLD.platform_fee_rate THEN changed := array_append(changed, 'platform_fee_rate'); END IF;
  IF NEW.payment_processing_fee IS DISTINCT FROM OLD.payment_processing_fee THEN changed := array_append(changed, 'payment_processing_fee'); END IF;
  IF NEW.payment_processing_fee_rate IS DISTINCT FROM OLD.payment_processing_fee_rate THEN changed := array_append(changed, 'payment_processing_fee_rate'); END IF;
  IF NEW.vaultshield_tier_fee IS DISTINCT FROM OLD.vaultshield_tier_fee THEN changed := array_append(changed, 'vaultshield_tier_fee'); END IF;
  IF NEW.vaultshield_tier_fee_rate IS DISTINCT FROM OLD.vaultshield_tier_fee_rate THEN changed := array_append(changed, 'vaultshield_tier_fee_rate'); END IF;
  IF NEW.promo_discount IS DISTINCT FROM OLD.promo_discount THEN changed := array_append(changed, 'promo_discount'); END IF;
  IF NEW.promo_code_id IS DISTINCT FROM OLD.promo_code_id THEN changed := array_append(changed, 'promo_code_id'); END IF;
  IF NEW.currency IS DISTINCT FROM OLD.currency THEN changed := array_append(changed, 'currency'); END IF;
  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id THEN changed := array_append(changed, 'buyer_id'); END IF;
  IF NEW.seller_id IS DISTINCT FROM OLD.seller_id THEN changed := array_append(changed, 'seller_id'); END IF;
  IF NEW.listing_id IS DISTINCT FROM OLD.listing_id THEN changed := array_append(changed, 'listing_id'); END IF;
  IF NEW.escrow_status IS DISTINCT FROM OLD.escrow_status THEN changed := array_append(changed, 'escrow_status'); END IF;
  IF array_length(changed, 1) > 0 THEN
    RAISE EXCEPTION 'orders: column(s) % are protected and cannot be changed by this caller',
      array_to_string(changed, ', ')
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_orders_protected_columns ON public.orders;
CREATE TRIGGER trg_guard_orders_protected_columns
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_orders_protected_columns();


-- ── flagged writers ──────────────────────────────────────────────────────────
-- (AUTH-002) writers of orders.escrow_status / profile balances
-- ── freeze_escrow — writes orders.escrow_status
-- Re-created verbatim from 20260101000000_baseline_live_schema.sql with the flag as the first statement.
CREATE OR REPLACE FUNCTION "public"."freeze_escrow"("order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  UPDATE public.orders
  SET
    escrow_status = 'frozen',
    auto_release_at = NULL -- Cancel auto-release timer
  WHERE id = order_id
  AND escrow_status = 'held';
END;
$$;

-- ── refund_escrow — writes orders.escrow_status
-- Re-created verbatim from 20260101000000_baseline_live_schema.sql with the flag as the first statement.
CREATE OR REPLACE FUNCTION "public"."refund_escrow"("order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  UPDATE public.orders
  SET
    status = 'refunded',
    escrow_status = 'refunded',
    completed_at = now()
  WHERE id = order_id
  AND escrow_status IN ('held', 'frozen');

  -- Here we would also:
  -- 1. Trigger Stripe refund
  -- 2. Send notification emails
END;
$$;

-- ── release_escrow — writes orders.escrow_status
-- Re-created verbatim from 20260101000000_baseline_live_schema.sql with the flag as the first statement.
CREATE OR REPLACE FUNCTION "public"."release_escrow"("order_id" "uuid", "method" "text" DEFAULT 'auto'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  UPDATE public.orders
  SET
    status = 'completed',
    escrow_status = 'released',
    release_method = method,
    completed_at = now()
  WHERE id = order_id
  AND escrow_status = 'held';

  -- Here we would also:
  -- 1. Trigger Stripe transfer to seller's connected account
  -- 2. Send notification emails to buyer and seller
  -- 3. Update seller stats (total_sales, total_revenue)
END;
$$;

-- ── release_with_reserve — writes profiles balances + orders.escrow_status
-- Re-created verbatim from 20260101000000_baseline_live_schema.sql with the flag as the first statement.
CREATE OR REPLACE FUNCTION "public"."release_with_reserve"("p_order_id" "uuid", "p_event" "text", "p_reserve_pct" numeric, "p_hold_seconds" bigint, "p_dedupe_key" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_order        RECORD;
  v_currency     CHAR(3);
  v_gross_minor  BIGINT;
  v_fee_minor    BIGINT;
  v_payout_minor BIGINT;
  v_reserve_minor BIGINT;
  v_avail_minor  BIGINT;
  v_idem         TEXT;
  v_txn_id       UUID;
  v_entries      JSONB;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  IF p_event NOT IN ('BUYER_CONFIRMED','AUTO_RELEASED','DISPUTE_RESOLVED_SELLER') THEN
    RAISE EXCEPTION 'release_with_reserve: event % is not a release event', p_event
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_reserve_pct < 0 OR p_reserve_pct > 1 THEN
    RAISE EXCEPTION 'release_with_reserve: reserve_pct must be in [0,1] (got %)', p_reserve_pct
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'release_with_reserve: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status = 'completed' THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'status', 'completed', 'changed', false);
  END IF;

  IF NOT is_valid_order_transition(v_order.status, 'completed') THEN
    RAISE EXCEPTION 'release_with_reserve: illegal % -> completed', v_order.status USING ERRCODE = 'check_violation';
  END IF;

  v_currency     := UPPER(COALESCE(v_order.currency, 'EUR'));
  v_gross_minor  := (COALESCE(v_order.total_amount, 0) * 100)::BIGINT;
  v_payout_minor := (COALESCE(v_order.seller_payout, 0) * 100)::BIGINT;
  -- Platform take derived (see safedrop_transition): fee = gross − payout.
  v_fee_minor    := v_gross_minor - v_payout_minor;

  v_reserve_minor := ROUND(v_payout_minor * p_reserve_pct);
  v_avail_minor   := v_payout_minor - v_reserve_minor;

  IF v_gross_minor > 0 THEN
    -- Sanity guard: seller payout must fit inside the gross.
    IF v_payout_minor < 0 OR v_payout_minor > v_gross_minor THEN
      RAISE EXCEPTION 'release_with_reserve: does not balance: payout(%) outside [0, gross(%)]',
        v_payout_minor, v_gross_minor USING ERRCODE = 'check_violation';
    END IF;

    v_entries := jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','escrow_held','direction','debit','amount_minor',v_gross_minor,'currency',v_currency)
    );
    IF v_fee_minor > 0 THEN
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_fee_minor,'currency',v_currency)
      );
    END IF;
    IF v_avail_minor > 0 THEN
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_available','direction','credit','amount_minor',v_avail_minor,'currency',v_currency)
      );
    END IF;
    IF v_reserve_minor > 0 THEN
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_reserve','direction','credit','amount_minor',v_reserve_minor,'currency',v_currency)
      );
    END IF;

    v_idem := 'order:' || p_order_id::text || ':' || p_event || COALESCE(':' || p_dedupe_key, '');
    v_txn_id := post_journal(v_idem, v_entries, p_event, p_order_id);

    IF v_reserve_minor > 0 THEN
      INSERT INTO reserve_holds (order_id, seller_id, amount_minor, currency, release_at)
      VALUES (p_order_id, v_order.seller_id, v_reserve_minor, v_currency, NOW() + make_interval(secs => p_hold_seconds))
      ON CONFLICT (order_id) DO NOTHING;
    END IF;

    -- Legacy profiles read-model sync (immediately-available portion only).
    IF v_avail_minor > 0 THEN
      UPDATE profiles
        SET seller_balance    = COALESCE(seller_balance, 0) + (v_avail_minor::NUMERIC / 100),
            pending_balance   = GREATEST(0, COALESCE(pending_balance, 0) - (v_avail_minor::NUMERIC / 100)),
            lifetime_earnings = COALESCE(lifetime_earnings, 0) + (v_avail_minor::NUMERIC / 100)
        WHERE id = v_order.seller_id;
    END IF;
  END IF;

  UPDATE orders
    SET status = 'completed', escrow_status = 'released',
        completed_at = COALESCE(completed_at, NOW())
    WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', p_order_id, 'status', 'completed',
    'reserve_minor', v_reserve_minor, 'available_minor', v_avail_minor,
    'ledger_txn_id', v_txn_id, 'changed', true
  );
END;
$$;

-- ── safedrop_transition — writes profiles balances + orders.escrow_status
-- Re-created verbatim from 20260101000000_baseline_live_schema.sql with the flag as the first statement.
CREATE OR REPLACE FUNCTION "public"."safedrop_transition"("p_order_id" "uuid", "p_event" "text", "p_dedupe_key" "text" DEFAULT NULL::"text", "p_release_method" "text" DEFAULT NULL::"text", "p_refund_minor" bigint DEFAULT NULL::bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_order        RECORD;
  v_target       TEXT;
  v_currency     CHAR(3);
  v_gross_minor  BIGINT;
  v_fee_minor    BIGINT;
  v_seller_minor BIGINT;
  v_refund_minor BIGINT;
  v_wallet_minor BIGINT;
  v_charge_minor BIGINT;
  v_idem         TEXT;
  v_txn_id       UUID;
  v_entries      JSONB;
  v_new_escrow   TEXT;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  v_target := safedrop_target_status(p_event);
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'safedrop_transition: unknown event %', p_event USING ERRCODE = 'check_violation';
  END IF;

  -- 1. LOCK the order row for the duration of the transaction.
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'safedrop_transition: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotency: already at target → no-op (money is separately idempotent).
  IF v_order.status = v_target THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'status', v_target, 'changed', false);
  END IF;

  -- 2. Validate the transition (same guard the trigger enforces).
  IF NOT is_valid_order_transition(v_order.status, v_target) THEN
    RAISE EXCEPTION 'safedrop_transition: illegal % -> % (event %)', v_order.status, v_target, p_event
      USING ERRCODE = 'check_violation';
  END IF;

  -- Amounts in integer minor units (exact NUMERIC * 100).
  v_currency     := UPPER(COALESCE(v_order.currency, 'EUR'));
  v_gross_minor  := (COALESCE(v_order.total_amount, 0) * 100)::BIGINT;
  v_seller_minor := (COALESCE(v_order.seller_payout, 0) * 100)::BIGINT;
  -- Platform take at release = gross − seller payout. orders.platform_fee is
  -- only the 2% marketplace line; the gross also carries the 5% processing
  -- fee and the per-category commission (minus promo) — deriving keeps the
  -- journal balanced for every real order.
  v_fee_minor    := v_gross_minor - v_seller_minor;

  v_entries := NULL;
  v_new_escrow := v_order.escrow_status;

  IF p_event = 'CHARGE_CONFIRMED' THEN
    -- Buyer paid: provider holds the cash; we record the escrow obligation.
    -- WALLET DEDUPE: any wallet-paid portion already credited escrow_held at
    -- checkout (spendWallet, key 'checkout_wallet:<order_id>') — only the
    -- remainder was charged at the provider.
    v_new_escrow := 'held';
    SELECT COALESCE(SUM(le.amount_minor), 0) INTO v_wallet_minor
    FROM ledger_transactions lt
    JOIN ledger_entries le ON le.transaction_id = lt.id
    JOIN ledger_accounts la ON la.id = le.account_id
    WHERE lt.idempotency_key = 'checkout_wallet:' || p_order_id::text
      AND la.kind = 'escrow_held'
      AND le.direction = 'credit';

    v_charge_minor := v_gross_minor - v_wallet_minor;
    IF v_charge_minor < 0 THEN
      RAISE EXCEPTION 'safedrop_transition: wallet credit (%) exceeds gross (%) for order %',
        v_wallet_minor, v_gross_minor, p_order_id USING ERRCODE = 'check_violation';
    END IF;
    IF v_charge_minor > 0 THEN
      v_entries := jsonb_build_array(
        jsonb_build_object('owner_type','provider','owner_id',NULL,'kind','provider_float','direction','debit','amount_minor',v_charge_minor,'currency',v_currency),
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','escrow_held','direction','credit','amount_minor',v_charge_minor,'currency',v_currency)
      );
    END IF;

  ELSIF p_event IN ('BUYER_CONFIRMED','AUTO_RELEASED','DISPUTE_RESOLVED_SELLER') THEN
    -- Release: escrow_held -> platform take + seller_available.
    v_new_escrow := 'released';
    IF v_gross_minor > 0 THEN
      -- Guard: the derived platform take must be sane (journal must balance).
      IF v_seller_minor < 0 OR v_seller_minor > v_gross_minor THEN
        RAISE EXCEPTION 'safedrop_transition: release does not balance: seller(%) outside [0, gross(%)]',
          v_seller_minor, v_gross_minor USING ERRCODE = 'check_violation';
      END IF;
      v_entries := jsonb_build_array(
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','escrow_held','direction','debit','amount_minor',v_gross_minor,'currency',v_currency)
      );
      IF v_fee_minor > 0 THEN
        v_entries := v_entries || jsonb_build_array(
          jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_fee_minor,'currency',v_currency)
        );
      END IF;
      IF v_seller_minor > 0 THEN
        v_entries := v_entries || jsonb_build_array(
          jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_available','direction','credit','amount_minor',v_seller_minor,'currency',v_currency)
        );
      END IF;
    END IF;

  ELSIF p_event = 'DISPUTE_PARTIAL' THEN
    -- Partial dispute resolution: buyer gets p_refund_minor back (the wallet
    -- credit rides on top, keyed 'wallet_refund:<order_id>:partial:<dispute_id>'),
    -- the seller keeps their payout minus the refund (floored at 0), and the
    -- platform take is only reduced when the refund exceeds the payout.
    v_new_escrow := 'released';
    IF p_refund_minor IS NULL OR p_refund_minor <= 0 OR p_refund_minor > v_gross_minor THEN
      RAISE EXCEPTION 'safedrop_transition: DISPUTE_PARTIAL refund (%) outside (0, gross(%)] for order %',
        p_refund_minor, v_gross_minor, p_order_id USING ERRCODE = 'check_violation';
    END IF;
    IF v_seller_minor < 0 OR v_seller_minor > v_gross_minor THEN
      RAISE EXCEPTION 'safedrop_transition: release does not balance: seller(%) outside [0, gross(%)]',
        v_seller_minor, v_gross_minor USING ERRCODE = 'check_violation';
    END IF;
    v_refund_minor := p_refund_minor;
    v_seller_minor := GREATEST(0, v_seller_minor - v_refund_minor);
    v_fee_minor    := v_gross_minor - v_refund_minor - v_seller_minor;
    v_entries := jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','escrow_held','direction','debit','amount_minor',v_gross_minor,'currency',v_currency),
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','refunds','direction','credit','amount_minor',v_refund_minor,'currency',v_currency)
    );
    IF v_fee_minor > 0 THEN
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_fee_minor,'currency',v_currency)
      );
    END IF;
    IF v_seller_minor > 0 THEN
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_available','direction','credit','amount_minor',v_seller_minor,'currency',v_currency)
      );
    END IF;

  ELSIF p_event IN ('REFUNDED','DISPUTE_RESOLVED_BUYER') THEN
    -- Refund: escrow_held -> refunds (wallet credit rides on top via
    -- wallet_credit, keyed 'wallet_refund:<order_id>').
    v_new_escrow := 'refunded';
    IF v_gross_minor > 0 THEN
      v_entries := jsonb_build_array(
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','escrow_held','direction','debit','amount_minor',v_gross_minor,'currency',v_currency),
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','refunds','direction','credit','amount_minor',v_gross_minor,'currency',v_currency)
      );
    END IF;

  ELSIF p_event = 'CANCELLED' THEN
    -- Cancel before release: if funds were held, return them (escrow_held -> refunds).
    IF v_order.escrow_status = 'held' AND v_gross_minor > 0 THEN
      v_new_escrow := 'refunded';
      v_entries := jsonb_build_array(
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','escrow_held','direction','debit','amount_minor',v_gross_minor,'currency',v_currency),
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','refunds','direction','credit','amount_minor',v_gross_minor,'currency',v_currency)
      );
    END IF;

  -- SELLER_DELIVERING / SELLER_DELIVERED / BUYER_DISPUTED: status only, no money move.
  END IF;

  -- 3. Post the ledger journal (if any) FIRST, idempotently.
  IF v_entries IS NOT NULL THEN
    v_idem := 'order:' || p_order_id::text || ':' || p_event || COALESCE(':' || p_dedupe_key, '');
    v_txn_id := post_journal(v_idem, v_entries, p_event, p_order_id);
  END IF;

  -- 3b. Release events: keep the LEGACY profiles read-model in sync in the
  -- same transaction so seller-balance displays that still read profiles
  -- stay truthful. For DISPUTE_PARTIAL the seller receives the REDUCED share
  -- (v_seller_minor after the refund came out of the payout) while the full
  -- pending amount for the order clears.
  IF p_event IN ('BUYER_CONFIRMED','AUTO_RELEASED','DISPUTE_RESOLVED_SELLER','DISPUTE_PARTIAL')
     AND COALESCE(v_order.seller_payout, 0) > 0 THEN
    UPDATE profiles
      SET seller_balance    = COALESCE(seller_balance, 0) + (v_seller_minor::NUMERIC / 100),
          pending_balance   = GREATEST(0, COALESCE(pending_balance, 0) - v_order.seller_payout),
          lifetime_earnings = COALESCE(lifetime_earnings, 0) + (v_seller_minor::NUMERIC / 100)
      WHERE id = v_order.seller_id;
  END IF;

  -- 4. Flip the order status + escrow_status (+ release_method on release).
  UPDATE orders
    SET status = v_target,
        escrow_status = v_new_escrow,
        completed_at = CASE WHEN v_target IN ('completed','refunded') THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
        release_method = CASE
          WHEN p_event IN ('BUYER_CONFIRMED','AUTO_RELEASED','DISPUTE_RESOLVED_SELLER','DISPUTE_PARTIAL')
            THEN COALESCE(p_release_method, release_method)
          ELSE release_method
        END
    WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'status', v_target,
    'escrow_status', v_new_escrow,
    'ledger_txn_id', v_txn_id,
    'changed', true
  );
END;
$$;

-- ── profiles: BEFORE UPDATE guard ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_profiles_protected_columns() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changed text[] := '{}';
BEGIN
  IF public.guarded_write_allowed() THEN
    RETURN NEW;
  END IF;
  IF NEW.seller_status IS DISTINCT FROM OLD.seller_status THEN changed := array_append(changed, 'seller_status'); END IF;
  IF NEW.seller_restriction_reason IS DISTINCT FROM OLD.seller_restriction_reason THEN changed := array_append(changed, 'seller_restriction_reason'); END IF;
  IF NEW.seller_restricted_at IS DISTINCT FROM OLD.seller_restricted_at THEN changed := array_append(changed, 'seller_restricted_at'); END IF;
  IF NEW.seller_restricted_by IS DISTINCT FROM OLD.seller_restricted_by THEN changed := array_append(changed, 'seller_restricted_by'); END IF;
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status THEN changed := array_append(changed, 'kyc_status'); END IF;
  IF NEW.kyc_submitted_at IS DISTINCT FROM OLD.kyc_submitted_at THEN changed := array_append(changed, 'kyc_submitted_at'); END IF;
  IF NEW.badges IS DISTINCT FROM OLD.badges THEN changed := array_append(changed, 'badges'); END IF;
  IF NEW.total_sales IS DISTINCT FROM OLD.total_sales THEN changed := array_append(changed, 'total_sales'); END IF;
  IF NEW.seller_rating IS DISTINCT FROM OLD.seller_rating THEN changed := array_append(changed, 'seller_rating'); END IF;
  IF NEW.total_reviews IS DISTINCT FROM OLD.total_reviews THEN changed := array_append(changed, 'total_reviews'); END IF;
  IF NEW.positive_reviews IS DISTINCT FROM OLD.positive_reviews THEN changed := array_append(changed, 'positive_reviews'); END IF;
  IF NEW.founding_seller IS DISTINCT FROM OLD.founding_seller THEN changed := array_append(changed, 'founding_seller'); END IF;
  IF NEW.is_test IS DISTINCT FROM OLD.is_test THEN changed := array_append(changed, 'is_test'); END IF;
  IF NEW.is_guest IS DISTINCT FROM OLD.is_guest THEN changed := array_append(changed, 'is_guest'); END IF;
  IF NEW.payout_enabled IS DISTINCT FROM OLD.payout_enabled THEN changed := array_append(changed, 'payout_enabled'); END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN changed := array_append(changed, 'email'); END IF;
  IF NEW.paypal_email IS DISTINCT FROM OLD.paypal_email THEN changed := array_append(changed, 'paypal_email'); END IF;
  IF NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id THEN changed := array_append(changed, 'stripe_account_id'); END IF;
  IF NEW.stripe_connect_account_id IS DISTINCT FROM OLD.stripe_connect_account_id THEN changed := array_append(changed, 'stripe_connect_account_id'); END IF;
  IF NEW.stripe_connect_status IS DISTINCT FROM OLD.stripe_connect_status THEN changed := array_append(changed, 'stripe_connect_status'); END IF;
  IF NEW.stripe_connect_charges_enabled IS DISTINCT FROM OLD.stripe_connect_charges_enabled THEN changed := array_append(changed, 'stripe_connect_charges_enabled'); END IF;
  IF NEW.stripe_connect_payouts_enabled IS DISTINCT FROM OLD.stripe_connect_payouts_enabled THEN changed := array_append(changed, 'stripe_connect_payouts_enabled'); END IF;
  IF NEW.stripe_connect_onboarding_url IS DISTINCT FROM OLD.stripe_connect_onboarding_url THEN changed := array_append(changed, 'stripe_connect_onboarding_url'); END IF;
  IF NEW.stripe_connect_connected_at IS DISTINCT FROM OLD.stripe_connect_connected_at THEN changed := array_append(changed, 'stripe_connect_connected_at'); END IF;
  IF NEW.seller_balance IS DISTINCT FROM OLD.seller_balance THEN changed := array_append(changed, 'seller_balance'); END IF;
  IF NEW.pending_balance IS DISTINCT FROM OLD.pending_balance THEN changed := array_append(changed, 'pending_balance'); END IF;
  IF NEW.lifetime_earnings IS DISTINCT FROM OLD.lifetime_earnings THEN changed := array_append(changed, 'lifetime_earnings'); END IF;
  IF NEW.loyalty_balance IS DISTINCT FROM OLD.loyalty_balance THEN changed := array_append(changed, 'loyalty_balance'); END IF;
  IF NEW.lifetime_cashback_earned IS DISTINCT FROM OLD.lifetime_cashback_earned THEN changed := array_append(changed, 'lifetime_cashback_earned'); END IF;
  IF array_length(changed, 1) > 0 THEN
    RAISE EXCEPTION 'profiles: column(s) % are protected and cannot be changed by this caller',
      array_to_string(changed, ', ')
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_profiles_protected_columns ON public.profiles;
CREATE TRIGGER trg_guard_profiles_protected_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_protected_columns();


-- (AUTH-005) writers of profiles counters / balances
-- ── update_listing_quantity — writes profiles.total_sales + listings.sales (AFTER UPDATE trigger on orders; fires under whichever JWT completed the order)
-- Re-created verbatim from 20260101000000_baseline_live_schema.sql with the flag as the first statement.
CREATE OR REPLACE FUNCTION "public"."update_listing_quantity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.listings
    SET
      quantity = CASE
        WHEN is_unlimited THEN quantity
        ELSE GREATEST(0, quantity - NEW.quantity)
      END,
      sales = sales + 1,
      status = CASE
        WHEN NOT is_unlimited AND quantity - NEW.quantity <= 0 THEN 'sold'
        ELSE status
      END
    WHERE id = NEW.listing_id;

    UPDATE public.profiles
    SET total_sales = total_sales + 1
    WHERE id = NEW.seller_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ── update_seller_rating — writes profiles.seller_rating/total_reviews/positive_reviews (trigger on reviews; fires under the buyer JWT)
-- Re-created verbatim from 20260101000000_baseline_live_schema.sql with the flag as the first statement.
CREATE OR REPLACE FUNCTION "public"."update_seller_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  seller_uuid UUID;
  avg_rating DECIMAL(2,1);
  review_count INTEGER;
  positive_count INTEGER;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  -- Determine which seller_id to update
  IF TG_OP = 'DELETE' THEN
    seller_uuid := OLD.seller_id;
  ELSE
    seller_uuid := NEW.seller_id;
  END IF;

  -- Calculate new rating statistics
  SELECT
    COALESCE(ROUND(AVG(rating)::NUMERIC, 1), 0.0)::DECIMAL(2,1),
    COUNT(*),
    COUNT(*) FILTER (WHERE rating >= 4)
  INTO avg_rating, review_count, positive_count
  FROM reviews
  WHERE seller_id = seller_uuid
    AND is_visible = true;

  -- Update profiles table
  UPDATE profiles
  SET
    seller_rating = avg_rating,
    total_reviews = review_count,
    positive_reviews = positive_count,
    updated_at = now()
  WHERE id = seller_uuid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── release_escrow_to_seller_balance — writes profiles.seller_balance/pending_balance/lifetime_earnings
-- Re-created verbatim from 20260101000000_baseline_live_schema.sql with the flag as the first statement.
CREATE OR REPLACE FUNCTION "public"."release_escrow_to_seller_balance"("p_order_id" "uuid", "p_seller_id" "uuid", "p_amount" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  -- Increment seller's available balance
  UPDATE profiles
  SET
    seller_balance   = seller_balance + p_amount,
    pending_balance  = GREATEST(0, pending_balance - p_amount),
    lifetime_earnings = lifetime_earnings + p_amount
  WHERE id = p_seller_id;

  -- Log to audit
  INSERT INTO audit_logs (action, table_name, record_id, new_data, performed_by, created_at)
  VALUES (
    'ESCROW_RELEASED_TO_BALANCE',
    'orders',
    p_order_id::TEXT,
    jsonb_build_object('seller_id', p_seller_id, 'amount', p_amount),
    NULL,  -- system action
    NOW()
  );
END;
$$;

-- ── listings: BEFORE UPDATE guard ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_listings_protected_columns() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changed text[] := '{}';
BEGIN
  IF public.guarded_write_allowed() THEN
    RETURN NEW;
  END IF;
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN changed := array_append(changed, 'approved_by'); END IF;
  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN changed := array_append(changed, 'approved_at'); END IF;
  IF NEW.rejected_by IS DISTINCT FROM OLD.rejected_by THEN changed := array_append(changed, 'rejected_by'); END IF;
  IF NEW.rejected_at IS DISTINCT FROM OLD.rejected_at THEN changed := array_append(changed, 'rejected_at'); END IF;
  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN changed := array_append(changed, 'rejection_reason'); END IF;
  IF NEW.moderation_notes IS DISTINCT FROM OLD.moderation_notes THEN changed := array_append(changed, 'moderation_notes'); END IF;
  IF NEW.seller_id IS DISTINCT FROM OLD.seller_id THEN changed := array_append(changed, 'seller_id'); END IF;
  IF NEW.sales IS DISTINCT FROM OLD.sales THEN changed := array_append(changed, 'sales'); END IF;
  IF array_length(changed, 1) > 0 THEN
    RAISE EXCEPTION 'listings: column(s) % are protected and cannot be changed by this caller',
      array_to_string(changed, ', ')
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_listings_protected_columns ON public.listings;
CREATE TRIGGER trg_guard_listings_protected_columns
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_listings_protected_columns();


-- (AUTH-006) moderation RPCs writing listings.approved_* / moderation_notes
-- ── approve_listing — writes listings.approved_by/approved_at/rejected_* (moderator RPC, runs under the moderator JWT)
-- Re-created verbatim from 20260903010000_lock_moderation_rpcs.sql with the flag as the first statement.
CREATE OR REPLACE FUNCTION public.approve_listing(listing_id uuid, admin_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  seller_id_var uuid;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  PERFORM public.assert_moderator();

  SELECT seller_id INTO seller_id_var
  FROM public.listings
  WHERE id = listing_id;

  UPDATE public.listings
  SET
    status = 'active',
    approved_by = admin_id,
    approved_at = now(),
    rejected_by = NULL,
    rejected_at = NULL,
    rejection_reason = NULL
  WHERE id = listing_id;
END;
$$;

-- ── reject_listing — writes listings.rejected_*/approved_* (moderator RPC)
-- Re-created verbatim from 20260903010000_lock_moderation_rpcs.sql with the flag as the first statement.
CREATE OR REPLACE FUNCTION public.reject_listing(listing_id uuid, admin_id uuid, reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  PERFORM public.assert_moderator();

  UPDATE public.listings
  SET
    status = 'rejected',
    rejected_by = admin_id,
    rejected_at = now(),
    rejection_reason = reason,
    approved_by = NULL,
    approved_at = NULL
  WHERE id = listing_id;
END;
$$;

-- ── request_listing_changes — writes listings.moderation_notes/approved_* (moderator RPC)
-- Re-created verbatim from 20260903010000_lock_moderation_rpcs.sql with the flag as the first statement.
CREATE OR REPLACE FUNCTION public.request_listing_changes(listing_id uuid, admin_id uuid, changes text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  PERFORM public.assert_moderator();

  UPDATE public.listings
  SET
    status = 'changes_requested',
    moderation_notes = changes,
    changes_requested_by = admin_id,
    changes_requested_at = now(),
    approved_by = NULL,
    approved_at = NULL,
    updated_at = now()
  WHERE id = listing_id;
END;
$$;
