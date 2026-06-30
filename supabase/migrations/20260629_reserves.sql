-- ============================================================
-- MONEY LAYER — Phase 5: reserves, reserve release, integrity checks
-- Created: 2026-06-29
--
-- Adds the reserve/clawback engine's data + the reserve-aware release path.
-- For CRYPTO (CoinGate) chargebackRisk=false → reservePct passed as 0 → the
-- engine is INERT (no reserve leg, behaves exactly like the current release).
-- It activates when cards (Tazapay) arrive and a non-zero rate is passed.
--
-- Reserve rate comes from the TS matrix (windows.ts, single source of truth):
-- the caller computes reservePct (category × risk tier / warranty tier) and
-- passes it in. No matrix duplicated in SQL.
--
-- Pieces:
--   1. reserve_holds table (one row per held reserve; release_at; status).
--   2. release_with_reserve() — atomic: validate transition, split
--      escrow_held → commission + seller_available + seller_reserve, record the
--      reserve_holds row, flip status. Supersedes the inline release for the
--      reserve-aware path. (reservePct=0 → no reserve leg, identical to before.)
--   3. release_due_reserves() — scheduled job: matured reserves
--      seller_reserve → seller_available, once each (idempotent on the hold id).
--   4. ledger_integrity_check() — provider-independent invariants for the
--      reconciliation job (balances-to-zero, stuck orders, escrow residue).
--
-- Idempotent migration. Service-role-only.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE reserve_hold_status AS ENUM ('held', 'released');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.reserve_holds (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL,
  seller_id    UUID NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency     CHAR(3) NOT NULL,
  release_at   TIMESTAMPTZ NOT NULL,
  status       reserve_hold_status NOT NULL DEFAULT 'held',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at  TIMESTAMPTZ,
  -- one reserve hold per order (a release happens once)
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS reserve_holds_due_idx
  ON public.reserve_holds (release_at)
  WHERE status = 'held';

-- ─── release_with_reserve: reserve-aware atomic release ───────────
-- Like safedrop_transition's release path, but splits a reserve portion into
-- seller_reserve and records a reserve_holds row. reservePct is a fraction
-- (0.10 = 10%) of the SELLER's payout (not gross). p_hold_seconds sets
-- release_at. With reservePct=0 it posts the plain release (no reserve leg).
--
-- This is the path the card (Tazapay) flow will call; the crypto flow can call
-- it with reservePct=0 or keep using safedrop_transition's BUYER_CONFIRMED path
-- (identical result). Kept separate so the reserve mechanics are explicit.
CREATE OR REPLACE FUNCTION release_with_reserve(
  p_order_id     UUID,
  p_event        TEXT,         -- BUYER_CONFIRMED | AUTO_RELEASED | DISPUTE_RESOLVED_SELLER
  p_reserve_pct  NUMERIC,      -- fraction of seller payout, e.g. 0.10; 0 = no reserve
  p_hold_seconds BIGINT,       -- how long to hold the reserve
  p_dedupe_key   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

  -- Idempotent: already completed → no-op.
  IF v_order.status = 'completed' THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'status', 'completed', 'changed', false);
  END IF;

  IF NOT is_valid_order_transition(v_order.status, 'completed') THEN
    RAISE EXCEPTION 'release_with_reserve: illegal % -> completed', v_order.status USING ERRCODE = 'check_violation';
  END IF;

  v_currency     := UPPER(COALESCE(v_order.currency, 'EUR'));
  v_gross_minor  := (COALESCE(v_order.total_amount, 0) * 100)::BIGINT;
  v_fee_minor    := (COALESCE(v_order.platform_fee, 0) * 100)::BIGINT;
  v_payout_minor := (COALESCE(v_order.seller_payout, 0) * 100)::BIGINT;

  -- Reserve is a cut of the seller's payout; remainder is immediately available.
  -- ROUND half-up; reserve gets the rounded value, available gets the rest, so
  -- fee + available + reserve == gross exactly (no minor unit lost).
  v_reserve_minor := ROUND(v_payout_minor * p_reserve_pct);
  v_avail_minor   := v_payout_minor - v_reserve_minor;

  IF v_gross_minor > 0 THEN
    -- balance guard
    IF v_fee_minor + v_avail_minor + v_reserve_minor <> v_gross_minor THEN
      RAISE EXCEPTION 'release_with_reserve: does not balance: fee(%) + avail(%) + reserve(%) <> gross(%)',
        v_fee_minor, v_avail_minor, v_reserve_minor, v_gross_minor USING ERRCODE = 'check_violation';
    END IF;

    v_entries := jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','escrow_held','direction','debit','amount_minor',v_gross_minor,'currency',v_currency),
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_fee_minor,'currency',v_currency)
    );
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

    -- Record the reserve hold (if any) for the release job. One per order.
    IF v_reserve_minor > 0 THEN
      INSERT INTO reserve_holds (order_id, seller_id, amount_minor, currency, release_at)
      VALUES (p_order_id, v_order.seller_id, v_reserve_minor, v_currency, NOW() + make_interval(secs => p_hold_seconds))
      ON CONFLICT (order_id) DO NOTHING;
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

-- ─── release_due_reserves: scheduled job ──────────────────────────
-- Moves matured reserves seller_reserve → seller_available. Each hold released
-- exactly once (status flip + idempotent journal keyed on the hold id).
-- Returns the count released.
CREATE OR REPLACE FUNCTION release_due_reserves(p_limit INT DEFAULT 500)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  FOR r IN
    SELECT * FROM reserve_holds
    WHERE status = 'held' AND release_at <= NOW()
    ORDER BY release_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM post_journal(
      'reserve_release:' || r.id::text,
      jsonb_build_array(
        jsonb_build_object('owner_type','seller','owner_id',r.seller_id::text,'kind','seller_reserve','direction','debit','amount_minor',r.amount_minor,'currency',r.currency),
        jsonb_build_object('owner_type','seller','owner_id',r.seller_id::text,'kind','seller_available','direction','credit','amount_minor',r.amount_minor,'currency',r.currency)
      ),
      'RESERVE_RELEASED',
      r.order_id
    );
    UPDATE reserve_holds SET status = 'released', released_at = NOW() WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ─── ledger_integrity_check: provider-independent invariants ──────
-- Returns a JSONB report; the reconciliation cron alerts on any non-OK field.
-- (Provider-balance reconciliation against CoinGate is a separate job, stubbed
-- until real settlement data flows — see reconciliation.ts.)
CREATE OR REPLACE FUNCTION ledger_integrity_check()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_unbalanced JSONB;
  v_escrow_residue JSONB;
  v_stuck INT;
BEGIN
  -- 1. Every transaction balances to zero per currency (the core invariant).
  SELECT COALESCE(jsonb_agg(jsonb_build_object('transaction_id', t.transaction_id, 'currency', t.currency, 'net', t.net)), '[]'::jsonb)
    INTO v_unbalanced
  FROM (
    SELECT transaction_id, currency,
           SUM(CASE WHEN direction='credit' THEN amount_minor ELSE -amount_minor END) AS net
    FROM ledger_entries
    GROUP BY transaction_id, currency
    HAVING SUM(CASE WHEN direction='credit' THEN amount_minor ELSE -amount_minor END) <> 0
  ) t;

  -- 2. Completed/refunded orders should leave no escrow_held residue attributable
  --    to them (sum of that order's escrow_held entries nets to zero).
  SELECT COALESCE(jsonb_agg(jsonb_build_object('order_id', x.order_id, 'currency', x.currency, 'residue', x.residue)), '[]'::jsonb)
    INTO v_escrow_residue
  FROM (
    SELECT lt.order_id, le.currency,
           SUM(CASE WHEN le.direction='credit' THEN le.amount_minor ELSE -le.amount_minor END) AS residue
    FROM ledger_entries le
    JOIN ledger_accounts la ON la.id = le.account_id AND la.kind = 'escrow_held'
    JOIN ledger_transactions lt ON lt.id = le.transaction_id
    JOIN orders o ON o.id = lt.order_id AND o.status IN ('completed','refunded','cancelled')
    GROUP BY lt.order_id, le.currency
    HAVING SUM(CASE WHEN le.direction='credit' THEN le.amount_minor ELSE -le.amount_minor END) <> 0
  ) x;

  -- 3. Orders stuck in a non-terminal state too long (here: paid/delivered > 30d).
  SELECT COUNT(*) INTO v_stuck
  FROM orders
  WHERE status IN ('paid','delivering','delivered','disputed')
    AND created_at < NOW() - INTERVAL '30 days';

  RETURN jsonb_build_object(
    'ok', (jsonb_array_length(v_unbalanced) = 0 AND jsonb_array_length(v_escrow_residue) = 0 AND v_stuck = 0),
    'unbalanced_transactions', v_unbalanced,
    'escrow_residue_on_terminal_orders', v_escrow_residue,
    'stuck_nonterminal_orders', v_stuck,
    'checked_at', NOW()
  );
END;
$$;

ALTER TABLE public.reserve_holds ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION release_with_reserve(UUID, TEXT, NUMERIC, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION release_due_reserves(INT)                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ledger_integrity_check()                                FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION release_with_reserve(UUID, TEXT, NUMERIC, BIGINT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION release_due_reserves(INT)                               TO service_role;
GRANT EXECUTE ON FUNCTION ledger_integrity_check()                                TO service_role;

COMMENT ON TABLE public.reserve_holds IS
  'Money layer: held seller reserves (chargeback buffer). Dormant for crypto (reservePct=0); active for cards. release_due_reserves() matures them seller_reserve→seller_available.';
