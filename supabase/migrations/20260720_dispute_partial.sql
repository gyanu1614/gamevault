-- ============================================================
-- MONEY LAYER — DISPUTE_PARTIAL split journal
-- Created: 2026-07-20
--
-- Fixes the partial-dispute ledger imbalance documented in
-- src/lib/actions/admin-disputes.ts: resolving a dispute with a PARTIAL
-- refund used DISPUTE_RESOLVED_SELLER, which released the seller's FULL
-- payout while the buyer's partial wallet credit debited `refunds` with
-- nothing feeding it. This adds a dedicated DISPUTE_PARTIAL event whose
-- journal splits the held gross in one balanced post:
--
--   escrow_held(gross) → refunds(partial refund)
--                      + platform_commission(take)
--                      + seller_available(payout − refund, floored at 0)
--
-- The refund comes out of the seller's payout FIRST; the platform take is
-- only reduced when the refund eats past the payout. The buyer's wallet
-- credit rides on top via wallet_credit (refunds → user_wallet), keyed
-- 'wallet_refund:<order_id>:partial:<dispute_id>'.
--
-- Deploy note: apply BEFORE the TS change ships — resolveDispute sends
-- DISPUTE_PARTIAL for partial refunds and will fail loudly (no money
-- moved, dispute stays open) until this function knows the event.
--
-- Non-destructive: replaces functions only (signature grows an optional
-- p_refund_minor arg, so the old 4-arg overload is dropped to avoid
-- named-call ambiguity — same pattern as 20260715_ledger_payout_cutover).
-- Idempotent migration. Service-role only.
-- ============================================================

-- ─── 1. Event → target status: DISPUTE_PARTIAL completes the order ─
CREATE OR REPLACE FUNCTION safedrop_target_status(p_event TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_event
    WHEN 'CHARGE_CONFIRMED'         THEN 'paid'
    WHEN 'SELLER_DELIVERING'        THEN 'delivering'
    WHEN 'SELLER_DELIVERED'         THEN 'delivered'
    WHEN 'BUYER_CONFIRMED'          THEN 'completed'
    WHEN 'AUTO_RELEASED'            THEN 'completed'
    WHEN 'BUYER_DISPUTED'           THEN 'disputed'
    WHEN 'DISPUTE_RESOLVED_SELLER'  THEN 'completed'
    WHEN 'DISPUTE_RESOLVED_BUYER'   THEN 'refunded'
    WHEN 'DISPUTE_PARTIAL'          THEN 'completed'
    WHEN 'REFUNDED'                 THEN 'refunded'
    WHEN 'CANCELLED'                THEN 'cancelled'
    ELSE NULL
  END;
$$;

-- ─── 2. safedrop_transition v3: + p_refund_minor / DISPUTE_PARTIAL ─
DROP FUNCTION IF EXISTS safedrop_transition(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION safedrop_transition(
  p_order_id       UUID,
  p_event          TEXT,
  p_dedupe_key     TEXT DEFAULT NULL,  -- optional extra dedupe (e.g. provider event id / dispute id)
  p_release_method TEXT DEFAULT NULL,  -- buyer_confirmed | auto | dispute_resolved (release events only)
  p_refund_minor   BIGINT DEFAULT NULL -- DISPUTE_PARTIAL only: buyer refund in minor units
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

REVOKE ALL ON FUNCTION safedrop_transition(UUID, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION safedrop_transition(UUID, TEXT, TEXT, TEXT, BIGINT) TO service_role;

COMMENT ON FUNCTION safedrop_transition(UUID, TEXT, TEXT, TEXT, BIGINT) IS
  'Money layer v3: atomic order transition + internal-ledger money move. Adds DISPUTE_PARTIAL: escrow_held(gross) → refunds(p_refund_minor) + platform take + reduced seller_available, so partial dispute refunds balance. Idempotent on (order, event[, dedupe]).';
