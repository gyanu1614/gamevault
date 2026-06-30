-- ============================================================
-- MONEY LAYER — Phase 2: Atomic SafeDrop transition RPC
-- Created: 2026-06-28
--
-- One function that, in a SINGLE DB transaction:
--   1. Locks the order row (SELECT ... FOR UPDATE) so a webhook and a user
--      action can't both mutate it and double-post (hardening §B #1 — the top
--      money-corruption risk).
--   2. Validates the status transition via is_valid_order_transition (the same
--      trigger guard; illegal moves are impossible at the DB layer).
--   3. Flips orders.status / escrow_status.
--   4. Posts the matching LEDGER journal (Phase 1 post_journal) in the SAME
--      transaction — so a status change and its money movement are atomic.
--   5. Is idempotent: the journal's idempotency_key is derived from
--      (order_id, event), so replaying an event no-ops the money move.
--
-- This is LEDGER-ONLY. It does NOT call any external payout rail (Stripe/
-- CoinGate) — that's the provider seam (Phase 3+). It fixes "auto-release
-- credits no one" at the ledger: AUTO_RELEASED / BUYER_CONFIRMED now post
-- escrow_held -> platform_commission + seller_available.
--
-- Money note: orders.* amounts are legacy NUMERIC (major units). We convert to
-- integer minor units at the boundary with (amount * 100)::BIGINT — Postgres
-- NUMERIC math is exact (no float drift).
--
-- Idempotent migration: CREATE OR REPLACE.
-- ============================================================

-- Maps a canonical order event to its target status. Mirrors EVENT_TARGET in
-- src/lib/escrow/state-machine.ts (kept in sync; the TS test cross-checks the
-- transition map, and this enum is small/stable).
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
    WHEN 'REFUNDED'                 THEN 'refunded'
    WHEN 'CANCELLED'                THEN 'cancelled'
    ELSE NULL
  END;
$$;

-- The atomic transition.
CREATE OR REPLACE FUNCTION safedrop_transition(
  p_order_id  UUID,
  p_event     TEXT,
  p_dedupe_key TEXT DEFAULT NULL   -- optional extra dedupe (e.g. provider event id)
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

  -- Idempotency: if the order is already AT the target (and this is a
  -- terminal/once-only move), treat as a no-op and return the current state.
  -- The ledger post is independently idempotent on v_idem below, so even if we
  -- proceed, money won't double-post. This early-out avoids a needless UPDATE.
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
  v_fee_minor    := (COALESCE(v_order.platform_fee, 0) * 100)::BIGINT;
  v_seller_minor := (COALESCE(v_order.seller_payout, 0) * 100)::BIGINT;

  -- Determine the ledger journal + new escrow_status for this event.
  v_entries := NULL;
  v_new_escrow := v_order.escrow_status;

  IF p_event = 'CHARGE_CONFIRMED' THEN
    -- Buyer paid: provider holds the cash; we record the escrow obligation.
    v_new_escrow := 'held';
    IF v_gross_minor > 0 THEN
      v_entries := jsonb_build_array(
        jsonb_build_object('owner_type','provider','owner_id',NULL,'kind','provider_float','direction','debit','amount_minor',v_gross_minor,'currency',v_currency),
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','escrow_held','direction','credit','amount_minor',v_gross_minor,'currency',v_currency)
      );
    END IF;

  ELSIF p_event IN ('BUYER_CONFIRMED','AUTO_RELEASED','DISPUTE_RESOLVED_SELLER') THEN
    -- Release: escrow_held -> platform_commission + seller_available.
    -- (Reserve split is added in Phase 5 when the reserve engine activates.)
    v_new_escrow := 'released';
    IF v_gross_minor > 0 THEN
      v_entries := jsonb_build_array(
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','escrow_held','direction','debit','amount_minor',v_gross_minor,'currency',v_currency),
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_fee_minor,'currency',v_currency),
        jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_available','direction','credit','amount_minor',v_seller_minor,'currency',v_currency)
      );
      -- Guard: fee + seller must equal gross (the journal must balance).
      IF v_fee_minor + v_seller_minor <> v_gross_minor THEN
        RAISE EXCEPTION 'safedrop_transition: release does not balance: fee(%) + seller(%) <> gross(%)',
          v_fee_minor, v_seller_minor, v_gross_minor USING ERRCODE = 'check_violation';
      END IF;
    END IF;

  ELSIF p_event IN ('REFUNDED','DISPUTE_RESOLVED_BUYER') THEN
    -- Refund: escrow_held -> refunds (buyer made whole; outbound rail in Phase 3+).
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

  -- 4. Flip the order status + escrow_status (the trigger re-validates + bumps version).
  UPDATE orders
    SET status = v_target,
        escrow_status = v_new_escrow,
        completed_at = CASE WHEN v_target IN ('completed','refunded') THEN COALESCE(completed_at, NOW()) ELSE completed_at END
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

REVOKE ALL ON FUNCTION safedrop_transition(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION safedrop_transition(UUID, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION safedrop_transition(UUID, TEXT, TEXT) IS
  'Money layer: atomic order transition. Locks the order, validates the status move, posts the matching ledger journal, and flips status — all in one transaction. Idempotent on (order, event[, dedupe]). Ledger-only; external payout is the provider seam (Phase 3+).';

-- ─── Test-only cleanup: remove ledger rows for a single order ──────
-- Integration tests create a throwaway order and drive it through transitions,
-- which post ledger journals keyed "order:<id>:<event>". This removes those
-- rows by order id (the append-only triggers block plain DELETE). Scoped to
-- one order, so it can only ever touch that order's ledger rows.
CREATE OR REPLACE FUNCTION ledger_test_cleanup_by_order(p_order_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count INT;
BEGIN
  ALTER TABLE ledger_entries      DISABLE TRIGGER trg_ledger_entries_immutable;
  ALTER TABLE ledger_transactions DISABLE TRIGGER trg_ledger_transactions_immutable;

  DELETE FROM ledger_entries
  WHERE transaction_id IN (SELECT id FROM ledger_transactions WHERE order_id = p_order_id);

  DELETE FROM ledger_transactions WHERE order_id = p_order_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  ALTER TABLE ledger_entries      ENABLE TRIGGER trg_ledger_entries_immutable;
  ALTER TABLE ledger_transactions ENABLE TRIGGER trg_ledger_transactions_immutable;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION ledger_test_cleanup_by_order(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ledger_test_cleanup_by_order(UUID) TO service_role;
