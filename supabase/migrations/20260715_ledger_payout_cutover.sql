-- ============================================================
-- MONEY LAYER — Phase 7: internal-ledger payout cutover
-- Created: 2026-07-15
--
-- Makes the internal ledger the ONLY completion payout rail (replacing the
-- Stripe Connect transfer) and closes the fee/wallet accounting holes that
-- blocked it:
--
--   1. Fee-math fix in safedrop_transition + release_with_reserve:
--      orders.platform_fee stores only the 2% marketplace component, but the
--      release guards required platform_fee + seller_payout == total_amount —
--      any real order (5% processing fee + commission − promo in the gross)
--      threw 'release does not balance'. The platform take at release is now
--      DERIVED: fee = gross − seller_payout (buyer fees + commission − promo),
--      guarded by 0 <= seller <= gross.
--   2. CHARGE_CONFIRMED wallet dedupe: a wallet-paid portion already credited
--      escrow_held at checkout ('checkout_wallet:<order_id>'); the confirm
--      journal now only posts the REMAINING provider-charged amount (skipping
--      the journal entirely for fully wallet-paid orders).
--   3. safedrop_transition grows p_release_method, written to
--      orders.release_method on release events (buyer_confirmed / auto /
--      dispute_resolved) so the CAS writers can be retired without losing it.
--   4. Release keeps the legacy profiles.seller_balance / lifetime_earnings
--      read-model in sync IN THE SAME TRANSACTION (what
--      release_escrow_to_seller_balance did), so existing seller-balance
--      surfaces stay truthful while they migrate to the ledger reader.
--   5. seller_available_balance(): derived seller balance reader (mirrors
--      user_wallet_balance, kind='seller_available').
--   6. withdrawal_debit / withdrawal_reversal: withdrawal requests now HOLD
--      funds (seller_available / user_wallet → payout_clearing) at creation,
--      idempotent on 'withdrawal:<request_id>'; reject/cancel posts the exact
--      mirror journal so "funds remain in your wallet" is true.
--
-- Deploy note: apply this migration BEFORE the TS cutover ships — without the
-- fee-math fix every ledger release throws and orders stick at 'delivered'.
--
-- Idempotent migration. Service-role only.
-- ============================================================

-- ─── 1+2+3+4. safedrop_transition v2 ──────────────────────────────
-- Adding a parameter changes the signature; drop the old 3-arg function so
-- named-argument RPC calls can't hit an ambiguous overload.
DROP FUNCTION IF EXISTS safedrop_transition(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION safedrop_transition(
  p_order_id       UUID,
  p_event          TEXT,
  p_dedupe_key     TEXT DEFAULT NULL,  -- optional extra dedupe (e.g. provider event id)
  p_release_method TEXT DEFAULT NULL   -- buyer_confirmed | auto | dispute_resolved (release events only)
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
  -- same transaction (same write release_escrow_to_seller_balance did) so
  -- seller-balance displays that still read profiles stay truthful.
  IF p_event IN ('BUYER_CONFIRMED','AUTO_RELEASED','DISPUTE_RESOLVED_SELLER')
     AND COALESCE(v_order.seller_payout, 0) > 0 THEN
    UPDATE profiles
      SET seller_balance    = COALESCE(seller_balance, 0) + v_order.seller_payout,
          pending_balance   = GREATEST(0, COALESCE(pending_balance, 0) - v_order.seller_payout),
          lifetime_earnings = COALESCE(lifetime_earnings, 0) + v_order.seller_payout
      WHERE id = v_order.seller_id;
  END IF;

  -- 4. Flip the order status + escrow_status (+ release_method on release).
  UPDATE orders
    SET status = v_target,
        escrow_status = v_new_escrow,
        completed_at = CASE WHEN v_target IN ('completed','refunded') THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
        release_method = CASE
          WHEN p_event IN ('BUYER_CONFIRMED','AUTO_RELEASED','DISPUTE_RESOLVED_SELLER')
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

REVOKE ALL ON FUNCTION safedrop_transition(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION safedrop_transition(UUID, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION safedrop_transition(UUID, TEXT, TEXT, TEXT) IS
  'Money layer v2: atomic order transition + internal-ledger money move. Release credits seller_available (fee derived as gross − seller_payout) and syncs the legacy profiles balance; CHARGE_CONFIRMED dedupes the wallet-paid portion. Idempotent on (order, event[, dedupe]).';

-- ─── release_with_reserve: same fee-math fix ──────────────────────
CREATE OR REPLACE FUNCTION release_with_reserve(
  p_order_id     UUID,
  p_event        TEXT,
  p_reserve_pct  NUMERIC,
  p_hold_seconds BIGINT,
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

REVOKE ALL ON FUNCTION release_with_reserve(UUID, TEXT, NUMERIC, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION release_with_reserve(UUID, TEXT, NUMERIC, BIGINT, TEXT) TO service_role;

-- ─── 5. Derived seller-available reader ───────────────────────────
CREATE OR REPLACE FUNCTION seller_available_balance(p_seller_id UUID, p_currency CHAR(3))
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(SUM(CASE WHEN le.direction='credit' THEN le.amount_minor ELSE -le.amount_minor END),0)::BIGINT
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  WHERE la.owner_type='seller' AND la.owner_id = p_seller_id AND la.kind='seller_available' AND la.currency = p_currency;
$$;

REVOKE ALL ON FUNCTION seller_available_balance(UUID, CHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seller_available_balance(UUID, CHAR) TO service_role;

COMMENT ON FUNCTION seller_available_balance(UUID, CHAR) IS
  'Money layer: derived seller available balance (sum of seller_available ledger entries). The withdrawal rail draws against this.';

-- ─── 6a. withdrawal_debit: hold funds at request creation ─────────
-- Draws the requested amount into payout_clearing from the user''s balances
-- in waterfall order: EUR seller_available → EUR user_wallet →
-- USD seller_available → USD user_wallet (legacy genesis balances are USD;
-- display treats both at par). Idempotent on p_idempotency_key
-- ('withdrawal:<request_id>'). Raises on insufficient combined balance.
CREATE OR REPLACE FUNCTION withdrawal_debit(
  p_user_id         UUID,
  p_amount_minor    BIGINT,
  p_idempotency_key TEXT,
  p_event_ref       TEXT DEFAULT 'WITHDRAWAL_HOLD'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_existing  UUID;
  v_remaining BIGINT;
  v_take      BIGINT;
  v_bal       BIGINT;
  v_entries   JSONB := '[]'::jsonb;
  v_clearing  JSONB := '[]'::jsonb;
  v_cur       CHAR(3);
  v_cur_total BIGINT;
  r RECORD;
BEGIN
  IF p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'withdrawal_debit: amount must be > 0' USING ERRCODE='check_violation';
  END IF;

  -- Idempotent: already posted → return it.
  SELECT id INTO v_existing FROM ledger_transactions WHERE idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  v_remaining := p_amount_minor;

  FOR r IN
    SELECT * FROM (VALUES
      ('EUR'::CHAR(3), 'seller_available', 'seller'),
      ('EUR'::CHAR(3), 'user_wallet',      'buyer'),
      ('USD'::CHAR(3), 'seller_available', 'seller'),
      ('USD'::CHAR(3), 'user_wallet',      'buyer')
    ) AS s(currency, kind, owner_type)
  LOOP
    EXIT WHEN v_remaining <= 0;

    IF r.kind = 'seller_available' THEN
      v_bal := seller_available_balance(p_user_id, r.currency);
    ELSE
      v_bal := user_wallet_balance(p_user_id, r.currency);
    END IF;

    v_take := LEAST(v_bal, v_remaining);
    IF v_take > 0 THEN
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('owner_type', r.owner_type, 'owner_id', p_user_id::text, 'kind', r.kind, 'direction', 'debit', 'amount_minor', v_take, 'currency', r.currency)
      );
      v_remaining := v_remaining - v_take;
    END IF;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'withdrawal_debit: insufficient balance (short % minor units)', v_remaining
      USING ERRCODE='check_violation';
  END IF;

  -- Balance each currency with a payout_clearing credit.
  FOR v_cur, v_cur_total IN
    SELECT (e->>'currency')::CHAR(3), SUM((e->>'amount_minor')::BIGINT)
    FROM jsonb_array_elements(v_entries) e
    GROUP BY (e->>'currency')::CHAR(3)
  LOOP
    v_clearing := v_clearing || jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','payout_clearing','direction','credit','amount_minor',v_cur_total,'currency',v_cur)
    );
  END LOOP;

  RETURN post_journal(p_idempotency_key, v_entries || v_clearing, p_event_ref, NULL);
END;
$$;

REVOKE ALL ON FUNCTION withdrawal_debit(UUID, BIGINT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION withdrawal_debit(UUID, BIGINT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION withdrawal_debit(UUID, BIGINT, TEXT, TEXT) IS
  'Money layer: holds withdrawal funds (seller_available/user_wallet → payout_clearing) at request creation, idempotent on the key. Prevents double-spending a pending withdrawal at checkout.';

-- ─── 6b. withdrawal_reversal: exact mirror on reject/cancel ───────
-- Reads the original hold journal ('withdrawal:<request_id>') and posts the
-- flipped entries under 'withdrawal_reversal:<request_id>'. No-op (NULL) when
-- no hold exists; idempotent when already reversed.
CREATE OR REPLACE FUNCTION withdrawal_reversal(p_request_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hold_txn UUID;
  v_existing UUID;
  v_entries  JSONB := '[]'::jsonb;
  r RECORD;
BEGIN
  SELECT id INTO v_existing FROM ledger_transactions
  WHERE idempotency_key = 'withdrawal_reversal:' || p_request_id::text;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT id INTO v_hold_txn FROM ledger_transactions
  WHERE idempotency_key = 'withdrawal:' || p_request_id::text;
  IF v_hold_txn IS NULL THEN RETURN NULL; END IF;

  FOR r IN
    SELECT la.owner_type, la.owner_id, la.kind, la.currency, le.direction, le.amount_minor
    FROM ledger_entries le
    JOIN ledger_accounts la ON la.id = le.account_id
    WHERE le.transaction_id = v_hold_txn
  LOOP
    v_entries := v_entries || jsonb_build_array(
      jsonb_build_object(
        'owner_type', r.owner_type,
        'owner_id',   r.owner_id,
        'kind',       r.kind,
        'direction',  CASE WHEN r.direction = 'debit' THEN 'credit' ELSE 'debit' END,
        'amount_minor', r.amount_minor,
        'currency',   r.currency
      )
    );
  END LOOP;

  RETURN post_journal('withdrawal_reversal:' || p_request_id::text, v_entries, 'WITHDRAWAL_REVERSED', NULL);
END;
$$;

REVOKE ALL ON FUNCTION withdrawal_reversal(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION withdrawal_reversal(UUID) TO service_role;

COMMENT ON FUNCTION withdrawal_reversal(UUID) IS
  'Money layer: exact mirror of a withdrawal hold journal (payout_clearing → original sources) on reject/cancel. Idempotent per request.';

-- ─── 7. checkout_wallet_hold_minor: how much wallet credit an order holds ──
-- Returns the wallet portion moved to escrow_held for an order at checkout
-- (idempotency key 'checkout_wallet:<order_id>'). createCheckout reads this
-- when it supersedes a stale pending order, to return exactly that credit to
-- the buyer's wallet (the CANCELLED transition only moves it to 'refunds').
-- SECURITY DEFINER + granted to authenticated so the buyer's session can read
-- it without exposing the ledger tables via RLS.
CREATE OR REPLACE FUNCTION checkout_wallet_hold_minor(p_order_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(SUM(le.amount_minor), 0)::BIGINT
  FROM ledger_transactions lt
  JOIN ledger_entries le ON le.transaction_id = lt.id
  JOIN ledger_accounts la ON la.id = le.account_id
  WHERE lt.idempotency_key = 'checkout_wallet:' || p_order_id::text
    AND la.kind = 'escrow_held'
    AND le.direction = 'credit';
$$;

REVOKE ALL ON FUNCTION checkout_wallet_hold_minor(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION checkout_wallet_hold_minor(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION checkout_wallet_hold_minor(UUID) IS
  'Money layer: wallet credit (minor units) held in escrow_held for an order at checkout. Read by createCheckout to refund a superseded pending order.';
