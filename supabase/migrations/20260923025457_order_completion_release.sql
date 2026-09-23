-- ============================================================================
-- Fee engine PR 7, Part 1 — completion and release rules.
-- Idempotent: safe to re-run.
--
-- Before this migration:
--   · the seller's "mark delivered" and the buyer's "open dispute" wrote
--     orders.status directly (session client / service role), bypassing
--     safedrop_transition; delivered_at and auto_release_at were stamped by TS;
--   · `status` was not a guarded column, so any party could move their own
--     order through PostgREST as long as the transition was legal;
--   · a buyer confirm credited seller_available immediately (no hold);
--   · the protection window lived in TS constants (not admin-editable);
--   · `completed` was terminal, so nothing could be disputed after completion.
--
-- After:
--   · every status change is ONE service-role RPC (order_mark_delivering,
--     order_mark_delivered, order_confirm_receipt, safedrop_transition) and
--     status/delivered_at/auto_release_at/completed_at/disputed_at are guarded;
--   · a buyer-confirmed release carries ledger_transactions.matures_at
--     (= completed_at + platform_fee_settings.completion_hold_hours, default 24 h);
--     an auto-complete matures immediately; seller_matured_balance excludes
--     unmatured credits — the withdrawal rail (Part 3) draws on that;
--   · per-category auto-complete windows are rows in order_completion_windows;
--   · completed → disputed is legal; a post-completion dispute moves the
--     order's seller amount seller_available → seller_frozen in the same
--     transition (Part 2 opens/resolves; the money branches live here so the
--     state machine has exactly one implementation);
--   · notifications gain a dedupe_key so every "notify once per transition"
--     is a DB guarantee (notify_once).
-- ============================================================================

-- Probe for integration tests: present ⇒ this migration is applied.
CREATE OR REPLACE FUNCTION public.order_completion_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.order_completion_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_completion_version() TO service_role;

-- ── 1. Settings (admin-editable data, single-row table) ─────────────────────
ALTER TABLE public.platform_fee_settings
  ADD COLUMN IF NOT EXISTS completion_hold_hours integer NOT NULL DEFAULT 24
    CHECK (completion_hold_hours >= 0 AND completion_hold_hours <= 24 * 90),
  ADD COLUMN IF NOT EXISTS dispute_window_days integer NOT NULL DEFAULT 7
    CHECK (dispute_window_days >= 0 AND dispute_window_days <= 365),
  ADD COLUMN IF NOT EXISTS withdrawal_min_account_age_days integer NOT NULL DEFAULT 30
    CHECK (withdrawal_min_account_age_days >= 0 AND withdrawal_min_account_age_days <= 3650),
  ADD COLUMN IF NOT EXISTS payout_details_freeze_hours integer NOT NULL DEFAULT 48
    CHECK (payout_details_freeze_hours >= 0 AND payout_details_freeze_hours <= 24 * 30);

COMMENT ON COLUMN public.platform_fee_settings.completion_hold_hours IS
  'Hours a buyer-confirmed release stays "pending maturity" before it is withdrawable (ledger_transactions.matures_at). Auto-completes mature immediately.';
COMMENT ON COLUMN public.platform_fee_settings.dispute_window_days IS
  'Days from orders.delivered_at in which a BUYER may open a dispute (admins are not bound by it).';
COMMENT ON COLUMN public.platform_fee_settings.withdrawal_min_account_age_days IS
  'A seller may withdraw only once their seller approval (fallback: profile creation) is at least this many days old.';
COMMENT ON COLUMN public.platform_fee_settings.payout_details_freeze_hours IS
  'Changing payout details (crypto address / Payoneer email) blocks withdrawals for this many hours.';

-- ── 2. Auto-complete windows per category type ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_completion_windows (
  category_type       text PRIMARY KEY
                      CHECK (category_type IN ('currency','items','account','top_up','service','gift_card')),
  auto_complete_hours integer NOT NULL CHECK (auto_complete_hours > 0 AND auto_complete_hours <= 24 * 60),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.order_completion_windows IS
  'Hours after delivered_at before an unconfirmed order auto-completes (SafeDrop Protection window), per game_categories.type. Admin-editable; every change writes a fee_config_audit row.';

INSERT INTO public.order_completion_windows (category_type, auto_complete_hours) VALUES
  ('items', 72), ('account', 120), ('currency', 24), ('top_up', 24), ('service', 72), ('gift_card', 24)
ON CONFLICT (category_type) DO NOTHING;

ALTER TABLE public.order_completion_windows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_completion_windows_read_all ON public.order_completion_windows;
CREATE POLICY order_completion_windows_read_all ON public.order_completion_windows FOR SELECT USING (true);
REVOKE ALL ON TABLE public.order_completion_windows FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.order_completion_windows TO anon, authenticated;

-- ── 3. Ledger: frozen account kind + maturity ───────────────────────────────
ALTER TYPE public.ledger_account_kind ADD VALUE IF NOT EXISTS 'seller_frozen';

ALTER TABLE public.ledger_transactions ADD COLUMN IF NOT EXISTS matures_at timestamptz;
COMMENT ON COLUMN public.ledger_transactions.matures_at IS
  'NULL = every entry counts immediately. Otherwise the seller_available credits in this journal are "pending maturity" until then (buyer-confirmed release hold).';
CREATE INDEX IF NOT EXISTS ledger_transactions_matures_at_idx
  ON public.ledger_transactions (matures_at) WHERE matures_at IS NOT NULL;

-- post_journal gains p_matures_at. The 4-arg signature is dropped so a call
-- with 2–4 args resolves unambiguously to this one.
DROP FUNCTION IF EXISTS public.post_journal(text, jsonb, text, uuid);
CREATE OR REPLACE FUNCTION public.post_journal(
  p_idempotency_key text, p_entries jsonb, p_event_ref text DEFAULT NULL, p_order_id uuid DEFAULT NULL,
  p_matures_at timestamptz DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_txn_id     UUID;
  v_existing   UUID;
  v_entry      JSONB;
  v_account_id UUID;
  v_count      INT;
  v_imbalance  RECORD;
BEGIN
  SELECT id INTO v_existing FROM ledger_transactions WHERE idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  IF jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'post_journal: p_entries must be a JSON array' USING ERRCODE = 'check_violation';
  END IF;
  v_count := jsonb_array_length(p_entries);
  IF v_count < 2 THEN
    RAISE EXCEPTION 'post_journal: a journal needs at least 2 entries (got %)', v_count USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_entries) e WHERE (e->>'amount_minor')::BIGINT <= 0) THEN
    RAISE EXCEPTION 'post_journal: every amount_minor must be > 0' USING ERRCODE = 'check_violation';
  END IF;

  FOR v_imbalance IN
    SELECT e->>'currency' AS currency,
           SUM(CASE WHEN e->>'direction' = 'debit'  THEN (e->>'amount_minor')::BIGINT ELSE 0 END) AS debits,
           SUM(CASE WHEN e->>'direction' = 'credit' THEN (e->>'amount_minor')::BIGINT ELSE 0 END) AS credits
    FROM jsonb_array_elements(p_entries) e GROUP BY e->>'currency'
  LOOP
    IF v_imbalance.debits <> v_imbalance.credits THEN
      RAISE EXCEPTION 'post_journal: imbalance in %: debits=% credits=%', v_imbalance.currency, v_imbalance.debits, v_imbalance.credits
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  BEGIN
    INSERT INTO ledger_transactions (idempotency_key, event_ref, order_id, matures_at)
    VALUES (p_idempotency_key, p_event_ref, p_order_id, p_matures_at)
    RETURNING id INTO v_txn_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_txn_id FROM ledger_transactions WHERE idempotency_key = p_idempotency_key;
    RETURN v_txn_id;
  END;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    v_account_id := ledger_resolve_account(
      (v_entry->>'owner_type')::ledger_owner_type,
      NULLIF(v_entry->>'owner_id', '')::UUID,
      (v_entry->>'kind')::ledger_account_kind,
      (v_entry->>'currency')::CHAR(3));
    INSERT INTO ledger_entries (transaction_id, account_id, direction, amount_minor, currency)
    VALUES (v_txn_id, v_account_id, (v_entry->>'direction')::ledger_direction, (v_entry->>'amount_minor')::BIGINT, (v_entry->>'currency')::CHAR(3));
  END LOOP;

  RETURN v_txn_id;
END;
$$;
REVOKE ALL ON FUNCTION public.post_journal(text, jsonb, text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_journal(text, jsonb, text, uuid, timestamptz) TO service_role;

-- Matured seller_available: every debit counts at once; a credit counts once
-- its journal has matured (matures_at NULL or in the past). Can be NEGATIVE
-- (post-completion refund larger than what the seller had) — that is the
-- point: future sale credits net against it and withdrawals refuse until > 0.
CREATE OR REPLACE FUNCTION public.seller_matured_balance(p_seller_id uuid, p_currency char DEFAULT 'USD')
  RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(CASE WHEN le.direction = 'credit' THEN le.amount_minor ELSE -le.amount_minor END), 0)::BIGINT
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.owner_type = 'seller' AND la.owner_id = p_seller_id
    AND la.kind = 'seller_available' AND la.currency = p_currency
    AND (le.direction = 'debit' OR lt.matures_at IS NULL OR lt.matures_at <= now());
$$;
REVOKE ALL ON FUNCTION public.seller_matured_balance(uuid, char) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_matured_balance(uuid, char) TO service_role;

CREATE OR REPLACE FUNCTION public.seller_frozen_balance(p_seller_id uuid, p_currency char DEFAULT 'USD')
  RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(CASE WHEN le.direction = 'credit' THEN le.amount_minor ELSE -le.amount_minor END), 0)::BIGINT
  FROM ledger_entries le JOIN ledger_accounts la ON la.id = le.account_id
  WHERE la.owner_type = 'seller' AND la.owner_id = p_seller_id AND la.kind::text = 'seller_frozen' AND la.currency = p_currency;
$$;
REVOKE ALL ON FUNCTION public.seller_frozen_balance(uuid, char) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_frozen_balance(uuid, char) TO service_role;

-- ── 4. State machine: completed → disputed becomes legal ────────────────────
CREATE OR REPLACE FUNCTION public.is_valid_order_transition(old_status text, new_status text) RETURNS boolean
  LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  -- Terminal states. `completed` may still be DISPUTED (buyer within the
  -- dispute window, or an admin at any time) — the money branch of
  -- safedrop_transition freezes the seller amount for that case.
  IF old_status IN ('cancelled', 'refunded') THEN
    RETURN FALSE;
  END IF;
  IF old_status = new_status THEN
    RETURN TRUE;
  END IF;
  RETURN CASE old_status
    WHEN 'pending'    THEN new_status IN ('paid', 'cancelled')
    WHEN 'paid'       THEN new_status IN ('delivering', 'delivered', 'disputed', 'cancelled', 'refunded')
    WHEN 'delivering' THEN new_status IN ('delivered', 'disputed', 'cancelled', 'refunded')
    WHEN 'delivered'  THEN new_status IN ('completed', 'disputed', 'refunded')
    WHEN 'completed'  THEN new_status IN ('disputed')
    WHEN 'disputed'   THEN new_status IN ('completed', 'cancelled', 'refunded')
    ELSE FALSE
  END;
END;
$$;
COMMENT ON FUNCTION public.is_valid_order_transition(text, text) IS
  'Permitted order status transitions. completed → disputed added by fee PR 7 (post-completion disputes freeze the seller amount in safedrop_transition).';

CREATE OR REPLACE FUNCTION public.safedrop_target_status(p_event text) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_event
    WHEN 'CHARGE_CONFIRMED'         THEN 'paid'
    WHEN 'SELLER_DELIVERING'        THEN 'delivering'
    WHEN 'SELLER_DELIVERED'         THEN 'delivered'
    WHEN 'BUYER_CONFIRMED'          THEN 'completed'
    WHEN 'AUTO_RELEASED'            THEN 'completed'
    WHEN 'BUYER_DISPUTED'           THEN 'disputed'
    WHEN 'ADMIN_DISPUTED'           THEN 'disputed'
    WHEN 'DISPUTE_RESOLVED_SELLER'  THEN 'completed'
    WHEN 'DISPUTE_RESOLVED_BUYER'   THEN 'refunded'
    WHEN 'DISPUTE_PARTIAL'          THEN 'completed'
    WHEN 'REFUNDED'                 THEN 'refunded'
    WHEN 'CANCELLED'                THEN 'cancelled'
    ELSE NULL
  END;
$$;

-- ── 5. safedrop_transition v3 ───────────────────────────────────────────────
-- Re-created in full from 20260911120000 (every existing branch verbatim) with:
--   · BUYER_CONFIRMED release journal carries matures_at (the hold);
--   · v_released (= the seller was already credited: completed_at IS NOT NULL
--     and the order is/was completed) switches the dispute branches to the
--     seller_frozen model: freeze on *_DISPUTED, unfreeze on RESOLVED_SELLER,
--     seller-first refund on RESOLVED_BUYER / REFUNDED / PARTIAL;
--   · CANCELLED refuses a released order (money already moved).
CREATE OR REPLACE FUNCTION public.safedrop_transition(
  p_order_id uuid, p_event text, p_dedupe_key text DEFAULT NULL, p_release_method text DEFAULT NULL, p_refund_minor bigint DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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
  v_seller_share BIGINT;
  v_plat_share   BIGINT;
  v_idem         TEXT;
  v_txn_id       UUID;
  v_entries      JSONB;
  v_new_escrow   TEXT;
  v_released     BOOLEAN;
  v_hold_hours   INT;
  v_matures_at   TIMESTAMPTZ := NULL;
  v_profile_delta BIGINT := 0;     -- signed change to profiles.seller_balance, minor units
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  v_target := safedrop_target_status(p_event);
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'safedrop_transition: unknown event %', p_event USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'safedrop_transition: order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.status = v_target THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'status', v_target, 'changed', false);
  END IF;

  IF NOT is_valid_order_transition(v_order.status, v_target) THEN
    RAISE EXCEPTION 'safedrop_transition: illegal % -> % (event %)', v_order.status, v_target, p_event
      USING ERRCODE = 'check_violation';
  END IF;

  v_currency     := UPPER(COALESCE(v_order.currency, 'EUR'));
  v_gross_minor  := (COALESCE(v_order.total_amount, 0) * 100)::BIGINT;
  v_seller_minor := (COALESCE(v_order.seller_payout, 0) * 100)::BIGINT;
  v_fee_minor    := v_gross_minor - v_seller_minor;
  -- The seller was credited at release: the order completed at some point and
  -- its escrow left `held`. A pre-completion dispute has completed_at NULL.
  v_released     := v_order.completed_at IS NOT NULL AND v_order.status IN ('completed', 'disputed')
                    AND v_order.escrow_status IN ('released', 'frozen');

  v_entries := NULL;
  v_new_escrow := v_order.escrow_status;

  IF p_event = 'CHARGE_CONFIRMED' THEN
    v_new_escrow := 'held';
    SELECT COALESCE(SUM(le.amount_minor), 0) INTO v_wallet_minor
    FROM ledger_transactions lt
    JOIN ledger_entries le ON le.transaction_id = lt.id
    JOIN ledger_accounts la ON la.id = le.account_id
    WHERE lt.idempotency_key = 'checkout_wallet:' || p_order_id::text
      AND la.kind = 'escrow_held' AND le.direction = 'credit';
    v_charge_minor := v_gross_minor - v_wallet_minor;
    IF v_charge_minor < 0 THEN
      RAISE EXCEPTION 'safedrop_transition: wallet credit (%) exceeds gross (%) for order %',
        v_wallet_minor, v_gross_minor, p_order_id USING ERRCODE = 'check_violation';
    END IF;
    IF v_charge_minor > 0 THEN
      v_entries := jsonb_build_array(
        jsonb_build_object('owner_type','provider','owner_id',NULL,'kind','provider_float','direction','debit','amount_minor',v_charge_minor,'currency',v_currency),
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','escrow_held','direction','credit','amount_minor',v_charge_minor,'currency',v_currency));
    END IF;

  ELSIF p_event IN ('BUYER_CONFIRMED','AUTO_RELEASED','DISPUTE_RESOLVED_SELLER') AND NOT v_released THEN
    -- Release: escrow_held -> platform take + seller_available.
    v_new_escrow := 'released';
    IF p_event = 'BUYER_CONFIRMED' THEN
      SELECT completion_hold_hours INTO v_hold_hours FROM platform_fee_settings WHERE id;
      IF COALESCE(v_hold_hours, 0) > 0 THEN
        v_matures_at := now() + make_interval(hours => v_hold_hours);
      END IF;
    END IF;
    IF v_gross_minor > 0 THEN
      IF v_seller_minor < 0 OR v_seller_minor > v_gross_minor THEN
        RAISE EXCEPTION 'safedrop_transition: release does not balance: seller(%) outside [0, gross(%)]',
          v_seller_minor, v_gross_minor USING ERRCODE = 'check_violation';
      END IF;
      v_entries := jsonb_build_array(
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','escrow_held','direction','debit','amount_minor',v_gross_minor,'currency',v_currency));
      IF v_fee_minor > 0 THEN
        v_entries := v_entries || jsonb_build_array(
          jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_fee_minor,'currency',v_currency));
      END IF;
      IF v_seller_minor > 0 THEN
        v_entries := v_entries || jsonb_build_array(
          jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_available','direction','credit','amount_minor',v_seller_minor,'currency',v_currency));
      END IF;
    END IF;
    v_profile_delta := v_seller_minor;

  ELSIF p_event = 'DISPUTE_RESOLVED_SELLER' AND v_released THEN
    -- Post-completion dispute released to the seller: unfreeze.
    v_new_escrow := 'released';
    IF v_seller_minor > 0 THEN
      v_entries := jsonb_build_array(
        jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_frozen','direction','debit','amount_minor',v_seller_minor,'currency',v_currency),
        jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_available','direction','credit','amount_minor',v_seller_minor,'currency',v_currency));
    END IF;

  ELSIF p_event IN ('BUYER_DISPUTED','ADMIN_DISPUTED') THEN
    IF v_released THEN
      -- Post-completion dispute: freeze the seller amount. seller_available may
      -- go negative if it was already withdrawn — allowed by design (Part 2).
      v_new_escrow := 'frozen';
      IF v_seller_minor > 0 THEN
        v_entries := jsonb_build_array(
          jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_available','direction','debit','amount_minor',v_seller_minor,'currency',v_currency),
          jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_frozen','direction','credit','amount_minor',v_seller_minor,'currency',v_currency));
      END IF;
    ELSIF v_order.escrow_status = 'held' THEN
      -- Pre-completion: funds are still in escrow_held; mark them frozen.
      v_new_escrow := 'frozen';
    END IF;

  ELSIF p_event = 'DISPUTE_PARTIAL' AND NOT v_released THEN
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
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','refunds','direction','credit','amount_minor',v_refund_minor,'currency',v_currency));
    IF v_fee_minor > 0 THEN
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','credit','amount_minor',v_fee_minor,'currency',v_currency));
    END IF;
    IF v_seller_minor > 0 THEN
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_available','direction','credit','amount_minor',v_seller_minor,'currency',v_currency));
    END IF;
    v_profile_delta := v_seller_minor;

  ELSIF p_event = 'DISPUTE_PARTIAL' AND v_released THEN
    -- Post-completion partial refund: the seller covers the refund first (up to
    -- their payout), the platform covers the rest out of its commission; the
    -- unrefunded remainder of the frozen amount goes back to seller_available.
    v_new_escrow := 'released';
    IF p_refund_minor IS NULL OR p_refund_minor <= 0 OR p_refund_minor > v_gross_minor THEN
      RAISE EXCEPTION 'safedrop_transition: DISPUTE_PARTIAL refund (%) outside (0, gross(%)] for order %',
        p_refund_minor, v_gross_minor, p_order_id USING ERRCODE = 'check_violation';
    END IF;
    v_refund_minor := p_refund_minor;
    v_seller_share := LEAST(v_refund_minor, v_seller_minor);
    v_plat_share   := v_refund_minor - v_seller_share;
    v_entries := jsonb_build_array(
      jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','refunds','direction','credit','amount_minor',v_refund_minor,'currency',v_currency));
    IF v_seller_minor > 0 THEN
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_frozen','direction','debit','amount_minor',v_seller_minor,'currency',v_currency));
    END IF;
    IF v_plat_share > 0 THEN
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','debit','amount_minor',v_plat_share,'currency',v_currency));
    END IF;
    IF v_seller_minor - v_seller_share > 0 THEN
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_available','direction','credit','amount_minor',v_seller_minor - v_seller_share,'currency',v_currency));
    END IF;
    v_profile_delta := -v_seller_share;

  ELSIF p_event IN ('REFUNDED','DISPUTE_RESOLVED_BUYER') AND NOT v_released THEN
    v_new_escrow := 'refunded';
    IF v_gross_minor > 0 THEN
      v_entries := jsonb_build_array(
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','escrow_held','direction','debit','amount_minor',v_gross_minor,'currency',v_currency),
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','refunds','direction','credit','amount_minor',v_gross_minor,'currency',v_currency));
    END IF;

  ELSIF p_event IN ('REFUNDED','DISPUTE_RESOLVED_BUYER') AND v_released THEN
    -- Post-completion full refund: seller_frozen (seller payout) + platform
    -- commission (the platform's take) -> refunds (gross). The buyer credit
    -- refunds -> user_wallet rides on top (order_refund_to_wallet).
    v_new_escrow := 'refunded';
    IF v_gross_minor > 0 THEN
      v_entries := jsonb_build_array(
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','refunds','direction','credit','amount_minor',v_gross_minor,'currency',v_currency));
      IF v_seller_minor > 0 THEN
        v_entries := v_entries || jsonb_build_array(
          jsonb_build_object('owner_type','seller','owner_id',v_order.seller_id::text,'kind','seller_frozen','direction','debit','amount_minor',v_seller_minor,'currency',v_currency));
      END IF;
      IF v_fee_minor > 0 THEN
        v_entries := v_entries || jsonb_build_array(
          jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','platform_commission','direction','debit','amount_minor',v_fee_minor,'currency',v_currency));
      END IF;
    END IF;
    v_profile_delta := -v_seller_minor;

  ELSIF p_event = 'CANCELLED' THEN
    IF v_released THEN
      RAISE EXCEPTION 'safedrop_transition: order % was already released to the seller — resolve the dispute instead of cancelling', p_order_id
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_order.escrow_status = 'held' AND v_gross_minor > 0 THEN
      v_new_escrow := 'refunded';
      v_entries := jsonb_build_array(
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','escrow_held','direction','debit','amount_minor',v_gross_minor,'currency',v_currency),
        jsonb_build_object('owner_type','platform','owner_id',NULL,'kind','refunds','direction','credit','amount_minor',v_gross_minor,'currency',v_currency));
    END IF;
  -- SELLER_DELIVERING / SELLER_DELIVERED: status only, no money move.
  END IF;

  IF v_entries IS NOT NULL THEN
    v_idem := 'order:' || p_order_id::text || ':' || p_event || COALESCE(':' || p_dedupe_key, '');
    v_txn_id := post_journal(v_idem, v_entries, p_event, p_order_id, v_matures_at);
  END IF;

  PERFORM money_fault_hook('safedrop_transition:after_journal');

  -- Legacy profiles read-model (seller_balance / pending_balance / lifetime).
  IF v_profile_delta <> 0 THEN
    UPDATE profiles
      SET seller_balance    = COALESCE(seller_balance, 0) + (v_profile_delta::NUMERIC / 100),
          pending_balance   = CASE WHEN v_profile_delta > 0
                                   THEN GREATEST(0, COALESCE(pending_balance, 0) - COALESCE(v_order.seller_payout, 0))
                                   ELSE pending_balance END,
          lifetime_earnings = CASE WHEN v_profile_delta > 0
                                   THEN COALESCE(lifetime_earnings, 0) + (v_profile_delta::NUMERIC / 100)
                                   ELSE lifetime_earnings END
      WHERE id = v_order.seller_id;
  END IF;

  UPDATE orders
    SET status = v_target,
        escrow_status = v_new_escrow,
        completed_at = CASE WHEN v_target IN ('completed','refunded') THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
        disputed_at  = CASE WHEN v_target = 'disputed' THEN NOW() ELSE disputed_at END,
        release_method = CASE
          WHEN p_event IN ('BUYER_CONFIRMED','AUTO_RELEASED','DISPUTE_RESOLVED_SELLER','DISPUTE_PARTIAL')
            THEN COALESCE(p_release_method, release_method)
          ELSE release_method END
    WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', p_order_id, 'status', v_target, 'escrow_status', v_new_escrow,
    'ledger_txn_id', v_txn_id, 'matures_at', v_matures_at, 'released_before', v_released,
    'seller_minor', v_seller_minor, 'changed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.safedrop_transition(uuid, text, text, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.safedrop_transition(uuid, text, text, text, bigint) TO service_role;

-- ── 6. orders: reminder stamp + guarded status columns ──────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS confirm_reminder_sent_at timestamptz;
COMMENT ON COLUMN public.orders.confirm_reminder_sent_at IS
  'Stamped once, atomically, when the halfway "please confirm receipt" reminder is claimed (order_confirm_reminders_claim).';

CREATE INDEX IF NOT EXISTS idx_orders_confirm_reminder_due
  ON public.orders (auto_release_at)
  WHERE status = 'delivered' AND confirm_reminder_sent_at IS NULL;

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
  -- ── fee engine (PR 1) ──
  IF NEW.seller_commission_pct IS DISTINCT FROM OLD.seller_commission_pct THEN changed := array_append(changed, 'seller_commission_pct'); END IF;
  IF NEW.seller_fee_trace IS DISTINCT FROM OLD.seller_fee_trace THEN changed := array_append(changed, 'seller_fee_trace'); END IF;
  -- ── fee engine (PR 7): the state machine is RPC-only ──
  IF NEW.status IS DISTINCT FROM OLD.status THEN changed := array_append(changed, 'status'); END IF;
  IF NEW.delivered_at IS DISTINCT FROM OLD.delivered_at THEN changed := array_append(changed, 'delivered_at'); END IF;
  IF NEW.auto_release_at IS DISTINCT FROM OLD.auto_release_at THEN changed := array_append(changed, 'auto_release_at'); END IF;
  IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN changed := array_append(changed, 'completed_at'); END IF;
  IF NEW.disputed_at IS DISTINCT FROM OLD.disputed_at THEN changed := array_append(changed, 'disputed_at'); END IF;
  IF NEW.release_method IS DISTINCT FROM OLD.release_method THEN changed := array_append(changed, 'release_method'); END IF;
  IF NEW.confirm_reminder_sent_at IS DISTINCT FROM OLD.confirm_reminder_sent_at THEN changed := array_append(changed, 'confirm_reminder_sent_at'); END IF;
  IF array_length(changed, 1) > 0 THEN
    RAISE EXCEPTION 'orders: column(s) % are protected and cannot be changed by this caller',
      array_to_string(changed, ', ') USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 7. Seller progress RPCs ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.order_completion_window_hours(p_order_id uuid) RETURNS integer
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT w.auto_complete_hours
       FROM orders o
       JOIN listings l ON l.id = o.listing_id
       JOIN game_categories gc ON gc.id = l.game_category_id
       JOIN order_completion_windows w ON w.category_type = gc.type
      WHERE o.id = p_order_id),
    72);
$$;
REVOKE ALL ON FUNCTION public.order_completion_window_hours(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_completion_window_hours(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.order_mark_delivering(p_order_id uuid, p_seller_id uuid) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  v_t     JSONB;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.seller_id IS DISTINCT FROM p_seller_id THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'not_found');
  END IF;
  IF v_order.status <> 'paid' THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'not_paid', 'status', v_order.status);
  END IF;
  v_t := safedrop_transition(p_order_id, 'SELLER_DELIVERING', NULL, NULL, NULL);
  UPDATE orders SET delivering_at = COALESCE(delivering_at, now()) WHERE id = p_order_id;
  RETURN v_t;
END;
$$;
REVOKE ALL ON FUNCTION public.order_mark_delivering(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_mark_delivering(uuid, uuid) TO service_role;

-- Seller marks delivered: SELLER_DELIVERED + delivered_at + auto_release_at
-- (= delivered_at + the category's window) in one transaction. Idempotent:
-- an order already past `delivering` returns changed=false and never restarts
-- the window.
CREATE OR REPLACE FUNCTION public.order_mark_delivered(p_order_id uuid, p_seller_id uuid) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  v_t     JSONB;
  v_hours INT;
  v_now   TIMESTAMPTZ := now();
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.seller_id IS DISTINCT FROM p_seller_id THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'not_found');
  END IF;
  IF v_order.status NOT IN ('paid', 'delivering') THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'not_deliverable', 'status', v_order.status);
  END IF;
  v_hours := order_completion_window_hours(p_order_id);
  v_t := safedrop_transition(p_order_id, 'SELLER_DELIVERED', NULL, NULL, NULL);
  PERFORM money_fault_hook('order_mark_delivered:after_transition');
  UPDATE orders
     SET delivered_at = v_now,
         auto_release_at = v_now + make_interval(hours => v_hours)
   WHERE id = p_order_id;
  RETURN v_t || jsonb_build_object('delivered_at', v_now, 'auto_release_at', v_now + make_interval(hours => v_hours), 'window_hours', v_hours,
                                   'buyer_id', v_order.buyer_id, 'order_number', v_order.order_number, 'listing_id', v_order.listing_id);
END;
$$;
REVOKE ALL ON FUNCTION public.order_mark_delivered(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_mark_delivered(uuid, uuid) TO service_role;

-- Buyer confirms receipt: (delivered if not yet) + BUYER_CONFIRMED release with
-- the maturity hold, in one transaction. Refuses (changed=false + reason)
-- rather than raising for the ordinary "wrong state" cases so the action can
-- show a message; raises only on money faults.
CREATE OR REPLACE FUNCTION public.order_confirm_receipt(p_order_id uuid, p_buyer_id uuid) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  v_t     JSONB;
  v_hours INT;
  v_now   TIMESTAMPTZ := now();
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.buyer_id IS DISTINCT FROM p_buyer_id THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'not_found');
  END IF;
  IF v_order.status = 'completed' THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'already_completed');
  END IF;
  IF v_order.status IN ('pending', 'cancelled', 'refunded') THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'not_paid', 'status', v_order.status);
  END IF;
  IF v_order.status = 'disputed' THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'disputed');
  END IF;
  IF v_order.escrow_status <> 'held' THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'changed', false, 'reason', 'not_held', 'escrow_status', v_order.escrow_status);
  END IF;

  IF v_order.status <> 'delivered' THEN
    -- Buyer confirms before the seller marked delivered: the delivery clock
    -- starts now (dispute window counts from delivered_at).
    v_hours := order_completion_window_hours(p_order_id);
    PERFORM safedrop_transition(p_order_id, 'SELLER_DELIVERED', NULL, NULL, NULL);
    UPDATE orders SET delivered_at = COALESCE(delivered_at, v_now),
                      auto_release_at = COALESCE(auto_release_at, v_now + make_interval(hours => v_hours))
     WHERE id = p_order_id;
  END IF;

  PERFORM money_fault_hook('order_confirm_receipt:before_release');
  v_t := safedrop_transition(p_order_id, 'BUYER_CONFIRMED', NULL, 'buyer_confirmed', NULL);
  PERFORM money_fault_hook('order_confirm_receipt:after_release');
  UPDATE orders SET buyer_confirmed_at = COALESCE(buyer_confirmed_at, v_now) WHERE id = p_order_id;

  RETURN v_t || jsonb_build_object('seller_id', v_order.seller_id, 'seller_payout', v_order.seller_payout,
                                   'order_number', v_order.order_number, 'listing_id', v_order.listing_id,
                                   'total_amount', v_order.total_amount);
END;
$$;
REVOKE ALL ON FUNCTION public.order_confirm_receipt(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_confirm_receipt(uuid, uuid) TO service_role;

-- ── 8. Auto-complete: paginated ready-list + halfway reminder claim ─────────
DROP FUNCTION IF EXISTS public.get_orders_ready_for_auto_release();
CREATE OR REPLACE FUNCTION public.get_orders_ready_for_auto_release(p_limit integer DEFAULT 200) RETURNS SETOF public.orders
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM orders
   WHERE status = 'delivered' AND escrow_status = 'held'
     AND auto_release_at IS NOT NULL AND auto_release_at <= now()
   ORDER BY auto_release_at ASC
   LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
$$;
REVOKE ALL ON FUNCTION public.get_orders_ready_for_auto_release(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_orders_ready_for_auto_release(integer) TO service_role;
COMMENT ON FUNCTION public.get_orders_ready_for_auto_release(integer) IS
  'Delivered, unconfirmed, undisputed orders whose window has closed (disputed orders leave status=delivered, so they are excluded by construction). Paginated; the hourly runner loops until a short page.';

-- Claims (stamps) the orders whose halfway point has passed and returns them.
-- The UPDATE … RETURNING is the once-only guarantee: two overlapping runs
-- cannot both claim the same order (FOR UPDATE SKIP LOCKED).
CREATE OR REPLACE FUNCTION public.order_confirm_reminders_claim(p_limit integer DEFAULT 100) RETURNS SETOF public.orders
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  RETURN QUERY
  UPDATE orders o SET confirm_reminder_sent_at = now()
   WHERE o.id IN (
     SELECT id FROM orders
      WHERE status = 'delivered' AND escrow_status = 'held'
        AND confirm_reminder_sent_at IS NULL
        AND delivered_at IS NOT NULL AND auto_release_at IS NOT NULL
        AND auto_release_at > now()
        AND delivered_at + (auto_release_at - delivered_at) / 2 <= now()
      ORDER BY auto_release_at ASC
      LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
      FOR UPDATE SKIP LOCKED)
  RETURNING o.*;
END;
$$;
REVOKE ALL ON FUNCTION public.order_confirm_reminders_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_confirm_reminders_claim(integer) TO service_role;

-- ── 9. Notifications: dedupe key + notify_once ──────────────────────────────
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_uidx
  ON public.notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_once(
  p_user_id uuid, p_type text, p_title text, p_message text, p_link text, p_dedupe_key text
) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_dedupe_key IS NULL OR length(p_dedupe_key) = 0 THEN
    RAISE EXCEPTION 'notify_once: user and dedupe key are required' USING ERRCODE = 'check_violation';
  END IF;
  IF p_link IS NOT NULL AND p_link !~ '^/[^/\\]' THEN
    RAISE EXCEPTION 'notify_once: link must be an internal path' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO notifications (user_id, type, title, message, link, is_read, dedupe_key)
  VALUES (p_user_id, p_type, p_title, p_message, p_link, false, p_dedupe_key)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_once(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_once(uuid, text, text, text, text, text) TO service_role;

-- ── 10. Seller withdrawal gate + balance breakdown ──────────────────────────
-- Anchor for "registered ≥ N days": the seller application's approval time
-- (seller_applications.reviewed_at, status approved); a seller with no
-- application row (legacy) falls back to profiles.created_at. Part 3 re-creates
-- this function adding the payout-details freeze.
CREATE OR REPLACE FUNCTION public.seller_since(p_seller_id uuid) RETURNS timestamptz
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT MIN(reviewed_at) FROM seller_applications WHERE user_id = p_seller_id AND status = 'approved' AND reviewed_at IS NOT NULL),
    (SELECT created_at FROM profiles WHERE id = p_seller_id));
$$;
REVOKE ALL ON FUNCTION public.seller_since(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_since(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.seller_withdrawal_gate(p_seller_id uuid) RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_since  TIMESTAMPTZ := seller_since(p_seller_id);
  v_days   INT;
  v_unlock TIMESTAMPTZ;
BEGIN
  SELECT withdrawal_min_account_age_days INTO v_days FROM platform_fee_settings WHERE id;
  v_unlock := COALESCE(v_since, now()) + make_interval(days => COALESCE(v_days, 30));
  IF v_since IS NULL OR v_unlock > now() THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'account_age', 'seller_since', v_since,
                              'unlock_at', v_unlock, 'min_age_days', v_days);
  END IF;
  RETURN jsonb_build_object('eligible', true, 'reason', NULL, 'seller_since', v_since, 'unlock_at', v_unlock, 'min_age_days', v_days);
END;
$$;
REVOKE ALL ON FUNCTION public.seller_withdrawal_gate(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_withdrawal_gate(uuid) TO service_role;

-- ONE function for every balance figure the wallet shows. Minor units (cents).
CREATE OR REPLACE FUNCTION public.wallet_available_balance(p_seller_id uuid, p_currency char DEFAULT 'USD') RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_available BIGINT := seller_matured_balance(p_seller_id, p_currency);
  v_pending   BIGINT;
  v_next      TIMESTAMPTZ;
  v_frozen    BIGINT := seller_frozen_balance(p_seller_id, p_currency);
  v_locked    BIGINT;
  v_wallet    BIGINT := user_wallet_balance(p_seller_id, p_currency);
  v_hold      INT;
  v_window    INT;
BEGIN
  SELECT COALESCE(SUM(le.amount_minor), 0), MIN(lt.matures_at) INTO v_pending, v_next
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  JOIN ledger_transactions lt ON lt.id = le.transaction_id
  WHERE la.owner_type = 'seller' AND la.owner_id = p_seller_id AND la.kind = 'seller_available'
    AND la.currency = p_currency AND le.direction = 'credit' AND lt.matures_at > now();

  SELECT COALESCE(SUM(ROUND(amount * 100)), 0)::BIGINT INTO v_locked
  FROM withdrawal_requests WHERE user_id = p_seller_id AND status IN ('pending', 'approved', 'processing');

  SELECT completion_hold_hours, dispute_window_days INTO v_hold, v_window FROM platform_fee_settings WHERE id;

  RETURN jsonb_build_object(
    'currency', p_currency,
    'available_minor', v_available,
    'pending_minor', v_pending,
    'next_maturity_at', v_next,
    'frozen_minor', v_frozen,
    'locked_minor', v_locked,
    'wallet_minor', v_wallet,
    'negative', v_available < 0,
    'gate', seller_withdrawal_gate(p_seller_id),
    'completion_hold_hours', v_hold,
    'dispute_window_days', v_window);
END;
$$;
REVOKE ALL ON FUNCTION public.wallet_available_balance(uuid, char) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_available_balance(uuid, char) TO service_role;
COMMENT ON FUNCTION public.wallet_available_balance(uuid, char) IS
  'Seller balance breakdown: available (matured, not frozen), pending maturity (+ next date), frozen (open disputes), locked (open withdrawals), store credit, negative flag, withdrawal gate. Service-role only; the wallet page reads it through a session-checked action.';
