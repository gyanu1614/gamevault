-- ============================================================================
-- Fee engine PR 7, Part 3 — withdrawal rules and fees as data + single RPCs.
-- Idempotent: safe to re-run.
--
-- Before: createWithdrawalRequest computed the fee in TS (calculate_withdrawal_fee
-- RPC → insert → withdrawal_debit, three round-trips, no lock, a HEAD count as
-- the one-open guard); approve / mark paid were two-step TS; payout details
-- were typed per request into a plaintext JSON column; crypto was 3% + $10.
--
-- After:
--   · withdrawal_methods: fee_min column; crypto 3% + $5 (min $50); Payoneer
--     3% with a $5 minimum fee (min $100). Admin-editable through
--     withdrawal_methods_set_fees, every change → fee_config_audit.
--   · fee_round_cents(): THE rounding helper (2 dp, half-up) — every fee and
--     amount goes through it.
--   · seller_payout_details: one row per seller (crypto address or Payoneer
--     email); any change stamps details_changed_at and blocks withdrawals for
--     platform_fee_settings.payout_details_freeze_hours (48 h).
--   · withdrawal_quote(seller, method, amount): fee_pct / fee_fixed / fee_min /
--     fee_amount / net and the FIRST refusal (method, account age, payout
--     freeze, negative balance, open withdrawal, missing payout details,
--     minimum, maximum, insufficient available).
--   · withdrawal_request(): advisory lock → quote → INSERT with every fee
--     field snapshotted → withdrawal_debit hold → notify_once, one transaction.
--     TS never computes a fee. One open request per seller (partial unique).
--   · withdrawal_approve / withdrawal_mark_paid (payout journal + reference)
--     / withdrawal_reject (re-created, adds notify_once): single RPCs with
--     deduped seller notifications.
--   · withdrawal_risk_snapshot(seller): account age, completed sales, open
--     disputes, refund rate, recent payout-detail change — for the admin list.
--   · platform_money_setting_set / order_completion_window_set: the Part 1/2
--     numbers become admin-editable with an audit row per change.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.withdrawal_rules_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.withdrawal_rules_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_rules_version() TO service_role;

-- ── 0. THE rounding helper ──────────────────────────────────────────────────
-- numeric round() is half-away-from-zero; every input here is >= 0, so this is
-- half-up to the cent. Stated once, used everywhere a fee or net is produced.
CREATE OR REPLACE FUNCTION public.fee_round_cents(p_amount numeric) RETURNS numeric
  LANGUAGE sql IMMUTABLE AS $$ SELECT round(COALESCE(p_amount, 0), 2) $$;
REVOKE ALL ON FUNCTION public.fee_round_cents(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fee_round_cents(numeric) TO service_role;

-- ── 1. Methods: fee_min + the new terms ─────────────────────────────────────
ALTER TABLE public.withdrawal_methods
  ADD COLUMN IF NOT EXISTS fee_min numeric(10,2) NOT NULL DEFAULT 0 CHECK (fee_min >= 0);
COMMENT ON COLUMN public.withdrawal_methods.fee_min IS
  'Minimum fee per withdrawal: fee = GREATEST(amount × fee_percentage/100 + fee_fixed, fee_min), rounded half-up to cents (fee_round_cents).';

-- Allow a fiat row without the crypto pair (Payoneer): the existing check
-- already permits method_type = 'fiat' with NULL coin/chain.
DO $$
DECLARE r RECORD;
BEGIN
  -- Crypto: 3% + $5, minimum $50 (was 3% + $10).
  FOR r IN SELECT * FROM public.withdrawal_methods WHERE method_type = 'crypto' LOOP
    IF r.fee_percentage IS DISTINCT FROM 3.00 OR r.fee_fixed IS DISTINCT FROM 5.00 OR r.min_withdrawal IS DISTINCT FROM 50.00 OR r.fee_min IS DISTINCT FROM 0 THEN
      INSERT INTO public.fee_config_audit (actor, scope, key, old_value, new_value)
      VALUES (NULL, 'withdrawal_method', r.method_name,
        jsonb_build_object('fee_percentage', r.fee_percentage, 'fee_fixed', r.fee_fixed, 'fee_min', r.fee_min, 'min_withdrawal', r.min_withdrawal),
        jsonb_build_object('fee_percentage', 3.00, 'fee_fixed', 5.00, 'fee_min', 0, 'min_withdrawal', 50.00, 'note', 'PR7: crypto 3% + $5, min $50'));
      UPDATE public.withdrawal_methods
         SET fee_percentage = 3.00, fee_fixed = 5.00, fee_min = 0, min_withdrawal = 50.00, updated_at = now()
       WHERE id = r.id;
    END IF;
  END LOOP;

  -- Payoneer: 3% with a $5 minimum fee, minimum withdrawal $100.
  IF NOT EXISTS (SELECT 1 FROM public.withdrawal_methods WHERE method_name = 'payoneer') THEN
    INSERT INTO public.withdrawal_methods
      (method_name, display_name, method_type, fee_percentage, fee_fixed, fee_min, fee_currency, min_withdrawal, max_withdrawal,
       processing_time, is_active, requires_kyc, icon_name, description, coming_soon, sort_order)
    VALUES
      ('payoneer', 'Payoneer', 'fiat', 3.00, 0, 5.00, 'USD', 100.00, 25000.00,
       '1–3 business days after approval', true, false, 'payoneer',
       'Paid to the Payoneer account saved in your payout settings.', false, 5);
    INSERT INTO public.fee_config_audit (actor, scope, key, old_value, new_value)
    VALUES (NULL, 'withdrawal_method', 'payoneer', NULL,
      jsonb_build_object('fee_percentage', 3.00, 'fee_fixed', 0, 'fee_min', 5.00, 'min_withdrawal', 100.00, 'note', 'PR7: Payoneer added'));
  END IF;
END $$;

-- ── 2. Saved payout details (one row per seller) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.seller_payout_details (
  seller_id           uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  crypto_coin         text CHECK (crypto_coin IS NULL OR crypto_coin IN ('btc', 'eth', 'usdt', 'usdc')),
  crypto_chain        text CHECK (crypto_chain IS NULL OR crypto_chain IN ('bitcoin', 'ethereum', 'tron', 'polygon')),
  crypto_address      text CHECK (crypto_address IS NULL OR length(crypto_address) BETWEEN 20 AND 128),
  payoneer_email      text CHECK (payoneer_email IS NULL OR payoneer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  details_changed_at  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_payout_details_crypto_shape CHECK (
    (crypto_address IS NULL AND crypto_coin IS NULL AND crypto_chain IS NULL) OR
    (crypto_address IS NOT NULL AND crypto_coin IS NOT NULL AND crypto_chain IS NOT NULL))
);
COMMENT ON TABLE public.seller_payout_details IS
  'Where a seller is paid: a crypto destination and/or a Payoneer email. Written only by seller_payout_details_set (server action, validated); any change stamps details_changed_at and freezes withdrawals for payout_details_freeze_hours.';
CREATE UNIQUE INDEX IF NOT EXISTS seller_payout_details_payoneer_email_uidx
  ON public.seller_payout_details (lower(payoneer_email)) WHERE payoneer_email IS NOT NULL;
ALTER TABLE public.seller_payout_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS seller_payout_details_owner_read ON public.seller_payout_details;
CREATE POLICY seller_payout_details_owner_read ON public.seller_payout_details FOR SELECT TO authenticated USING (auth.uid() = seller_id);
REVOKE ALL ON TABLE public.seller_payout_details FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.seller_payout_details TO authenticated;

-- ── 3. Requests: fee snapshot columns + one open per seller ─────────────────
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS fee_fixed numeric(10,2),
  ADD COLUMN IF NOT EXISTS fee_min numeric(10,2),
  ADD COLUMN IF NOT EXISTS quote jsonb;
COMMENT ON COLUMN public.withdrawal_requests.quote IS 'The full withdrawal_quote() row this request was created from — the fee terms at request time, never recomputed.';

DO $$
DECLARE v_dupes INT;
BEGIN
  SELECT count(*) INTO v_dupes FROM (
    SELECT user_id FROM public.withdrawal_requests WHERE status IN ('pending', 'approved', 'processing')
    GROUP BY user_id HAVING count(*) > 1) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'withdrawal_rules: % seller(s) have more than one OPEN withdrawal — resolve them (approve+pay or reject) before applying', v_dupes;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_one_open_per_user
  ON public.withdrawal_requests (user_id) WHERE status IN ('pending', 'approved', 'processing');

-- ── 4. Gate (re-created: + payout-details freeze) ───────────────────────────
CREATE OR REPLACE FUNCTION public.seller_withdrawal_gate(p_seller_id uuid) RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_since   TIMESTAMPTZ := seller_since(p_seller_id);
  v_days    INT;
  v_freeze  INT;
  v_unlock  TIMESTAMPTZ;
  v_changed TIMESTAMPTZ;
  v_until   TIMESTAMPTZ;
BEGIN
  SELECT withdrawal_min_account_age_days, payout_details_freeze_hours INTO v_days, v_freeze FROM platform_fee_settings WHERE id;
  v_unlock := COALESCE(v_since, now()) + make_interval(days => COALESCE(v_days, 30));
  SELECT details_changed_at INTO v_changed FROM seller_payout_details WHERE seller_id = p_seller_id;
  v_until := CASE WHEN v_changed IS NULL THEN NULL ELSE v_changed + make_interval(hours => COALESCE(v_freeze, 48)) END;

  IF v_since IS NULL OR v_unlock > now() THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'account_age', 'seller_since', v_since,
                              'unlock_at', v_unlock, 'min_age_days', v_days, 'freeze_until', v_until);
  END IF;
  IF v_until IS NOT NULL AND v_until > now() THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'payout_details_freeze', 'seller_since', v_since,
                              'unlock_at', v_unlock, 'min_age_days', v_days, 'freeze_until', v_until, 'freeze_hours', v_freeze);
  END IF;
  RETURN jsonb_build_object('eligible', true, 'reason', NULL, 'seller_since', v_since, 'unlock_at', v_unlock,
                            'min_age_days', v_days, 'freeze_until', v_until);
END;
$$;

-- ── 5. Quote ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.withdrawal_quote(p_seller_id uuid, p_method_id uuid, p_amount numeric) RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_m         RECORD;
  v_amount    NUMERIC := fee_round_cents(COALESCE(p_amount, 0));
  v_fee       NUMERIC := 0;
  v_net       NUMERIC := 0;
  v_gate      JSONB;
  v_matured   BIGINT := seller_matured_balance(p_seller_id, 'USD');
  v_wallet    BIGINT := user_wallet_balance(p_seller_id, 'USD');
  v_available BIGINT;
  v_open      UUID;
  v_details   RECORD;
  v_refusal   TEXT := NULL;
  v_message   TEXT := NULL;
  v_extra     JSONB := '{}'::jsonb;
BEGIN
  SELECT * INTO v_m FROM withdrawal_methods WHERE id = p_method_id;
  IF NOT FOUND OR v_m.is_active IS DISTINCT FROM true OR v_m.coming_soon THEN
    RETURN jsonb_build_object('ok', false, 'refusal', 'method_unavailable', 'message', 'That withdrawal method is not available.',
                              'amount', v_amount, 'fee_amount', 0, 'net', 0);
  END IF;

  v_fee := fee_round_cents(GREATEST(v_amount * COALESCE(v_m.fee_percentage, 0) / 100 + COALESCE(v_m.fee_fixed, 0), COALESCE(v_m.fee_min, 0)));
  v_net := fee_round_cents(v_amount - v_fee);
  v_available := v_matured + v_wallet;
  v_gate := seller_withdrawal_gate(p_seller_id);
  SELECT id INTO v_open FROM withdrawal_requests WHERE user_id = p_seller_id AND status IN ('pending', 'approved', 'processing') LIMIT 1;
  SELECT * INTO v_details FROM seller_payout_details WHERE seller_id = p_seller_id;

  IF NOT (v_gate->>'eligible')::boolean THEN
    v_refusal := v_gate->>'reason';
    v_message := CASE v_refusal
      WHEN 'account_age' THEN 'Withdrawals open ' || COALESCE(v_gate->>'min_age_days', '30') || ' days after your seller account is approved — from ' || to_char((v_gate->>'unlock_at')::timestamptz, 'DD Mon YYYY') || '.'
      ELSE 'You changed your payout details recently. For your security, withdrawals reopen on ' || to_char((v_gate->>'freeze_until')::timestamptz, 'DD Mon YYYY HH24:MI') || ' UTC.' END;
  ELSIF v_matured < 0 THEN
    v_refusal := 'negative_balance';
    v_message := 'Your balance is below zero after a refund. Withdrawals reopen once new sales bring it back above zero.';
  ELSIF v_open IS NOT NULL THEN
    v_refusal := 'open_withdrawal';
    v_message := 'You already have a withdrawal in progress. Wait for it to complete or cancel it first.';
    v_extra := jsonb_build_object('open_request_id', v_open);
  ELSIF (v_m.method_type = 'crypto' AND (v_details.crypto_address IS NULL OR v_details.crypto_chain IS DISTINCT FROM v_m.chain OR v_details.crypto_coin IS DISTINCT FROM v_m.coin))
     OR (v_m.method_name = 'payoneer' AND v_details.payoneer_email IS NULL) THEN
    v_refusal := 'payout_details_missing';
    v_message := CASE WHEN v_m.method_type = 'crypto'
      THEN 'Save a ' || upper(COALESCE(v_m.coin, '')) || ' address on ' || COALESCE(v_m.chain, '') || ' in your payout settings first.'
      ELSE 'Save your Payoneer email in your payout settings first.' END;
  ELSIF v_amount < COALESCE(v_m.min_withdrawal, 0) THEN
    v_refusal := 'below_minimum';
    v_message := 'Minimum withdrawal for ' || v_m.display_name || ' is $' || to_char(v_m.min_withdrawal, 'FM999999990.00') || '.';
  ELSIF v_m.max_withdrawal IS NOT NULL AND v_amount > v_m.max_withdrawal THEN
    v_refusal := 'above_maximum';
    v_message := 'Maximum withdrawal for ' || v_m.display_name || ' is $' || to_char(v_m.max_withdrawal, 'FM999999990.00') || '.';
  ELSIF ROUND(v_amount * 100) > v_available THEN
    v_refusal := 'insufficient_available';
    v_message := 'You can withdraw up to $' || to_char(v_available::numeric / 100, 'FM999999990.00') || ' right now.';
  ELSIF v_fee >= v_amount THEN
    v_refusal := 'fee_exceeds_amount';
    v_message := 'The fee would exceed the amount.';
  END IF;

  RETURN jsonb_build_object(
    'ok', v_refusal IS NULL, 'refusal', v_refusal, 'message', v_message,
    'method', jsonb_build_object('id', v_m.id, 'name', v_m.method_name, 'display_name', v_m.display_name, 'type', v_m.method_type, 'coin', v_m.coin, 'chain', v_m.chain),
    'amount', v_amount, 'fee_pct', COALESCE(v_m.fee_percentage, 0), 'fee_fixed', COALESCE(v_m.fee_fixed, 0), 'fee_min', COALESCE(v_m.fee_min, 0),
    'fee_amount', v_fee, 'net', v_net,
    'minimum', v_m.min_withdrawal, 'maximum', v_m.max_withdrawal,
    'available_minor', v_available, 'matured_minor', v_matured, 'wallet_minor', v_wallet,
    'gate', v_gate) || v_extra;
END;
$$;
REVOKE ALL ON FUNCTION public.withdrawal_quote(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_quote(uuid, uuid, numeric) TO service_role;

-- ── 6. Request ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.withdrawal_request(p_seller_id uuid, p_method_id uuid, p_amount numeric) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_q        JSONB;
  v_m        RECORD;
  v_details  RECORD;
  v_payment  JSONB;
  v_id       UUID;
  v_amount   NUMERIC;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  -- Serialise per seller: the balance read, the one-open check and the hold
  -- happen under one lock (PAY-001 lesson: a guard read outside the lock is
  -- no guard).
  PERFORM pg_advisory_xact_lock(hashtextextended('withdrawal_request:' || p_seller_id::text, 0));

  v_q := withdrawal_quote(p_seller_id, p_method_id, p_amount);
  IF NOT (v_q->>'ok')::boolean THEN
    RETURN jsonb_build_object('requested', false, 'quote', v_q);
  END IF;
  v_amount := (v_q->>'amount')::numeric;

  SELECT * INTO v_m FROM withdrawal_methods WHERE id = p_method_id;
  SELECT * INTO v_details FROM seller_payout_details WHERE seller_id = p_seller_id;
  v_payment := CASE WHEN v_m.method_type = 'crypto'
    THEN jsonb_build_object('wallet_address', v_details.crypto_address, 'network', v_details.crypto_chain, 'coin', v_details.crypto_coin)
    ELSE jsonb_build_object('payoneer_email', v_details.payoneer_email) END;

  INSERT INTO withdrawal_requests
    (user_id, amount, method_id, method_name, fee_amount, fee_percentage, fee_fixed, fee_min, net_amount, payment_details, quote, status)
  VALUES
    (p_seller_id, v_amount, p_method_id, v_m.method_name,
     (v_q->>'fee_amount')::numeric, (v_q->>'fee_pct')::numeric, (v_q->>'fee_fixed')::numeric, (v_q->>'fee_min')::numeric,
     (v_q->>'net')::numeric, v_payment, v_q, 'pending')
  RETURNING id INTO v_id;

  -- Hold: seller_available / user_wallet → payout_clearing (idempotent key).
  PERFORM withdrawal_debit(p_seller_id, ROUND(v_amount * 100)::bigint, 'withdrawal:' || v_id::text, 'WITHDRAWAL_REQUESTED');
  PERFORM money_fault_hook('withdrawal_request:after_hold');

  PERFORM notify_once(p_seller_id, 'withdrawal_requested', 'Withdrawal Requested',
    '$' || to_char(v_amount, 'FM999999990.00') || ' → ' || v_m.display_name || ' — you receive $' || (v_q->>'net') || ' after the $' || (v_q->>'fee_amount') || ' fee. We review requests within 1–2 business days.',
    '/account/wallet', 'withdrawal:' || v_id::text || ':requested');

  RETURN jsonb_build_object('requested', true, 'request_id', v_id, 'quote', v_q, 'method_name', v_m.method_name, 'display_name', v_m.display_name);
END;
$$;
REVOKE ALL ON FUNCTION public.withdrawal_request(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_request(uuid, uuid, numeric) TO service_role;

-- ── 7. Approve / mark paid / reject ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.withdrawal_approve(p_request_id uuid, p_admin_id uuid, p_notes text DEFAULT NULL) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req RECORD; v_display TEXT;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_req FROM withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('changed', false, 'reason', 'not_found'); END IF;
  IF v_req.status <> 'pending' THEN RETURN jsonb_build_object('changed', false, 'status', v_req.status); END IF;
  UPDATE withdrawal_requests
     SET status = 'approved', approved_at = now(), processed_by = p_admin_id,
         admin_notes = COALESCE(NULLIF(p_notes, ''), admin_notes), updated_at = now()
   WHERE id = p_request_id;
  SELECT display_name INTO v_display FROM withdrawal_methods WHERE id = v_req.method_id;
  PERFORM notify_once(v_req.user_id, 'withdrawal_approved', 'Withdrawal Approved',
    '$' || to_char(v_req.amount, 'FM999999990.00') || ' → ' || COALESCE(v_display, v_req.method_name) || ' — processing. You receive $' || to_char(v_req.net_amount, 'FM999999990.00') || '.',
    '/account/wallet', 'withdrawal:' || p_request_id::text || ':approved');
  RETURN jsonb_build_object('changed', true, 'status', 'approved', 'user_id', v_req.user_id, 'amount', v_req.amount,
                            'net_amount', v_req.net_amount, 'method_name', v_req.method_name, 'display_name', v_display);
END;
$$;
REVOKE ALL ON FUNCTION public.withdrawal_approve(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_approve(uuid, uuid, text) TO service_role;

-- Settles the ledger (withdrawal_payout: payout_clearing → external_payout +
-- platform fee) THEN flips to completed with the reference — one transaction.
CREATE OR REPLACE FUNCTION public.withdrawal_mark_paid(p_request_id uuid, p_admin_id uuid, p_reference text, p_notes text DEFAULT NULL) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req RECORD; v_txn UUID; v_display TEXT; v_is_crypto BOOLEAN;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_req FROM withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('changed', false, 'reason', 'not_found'); END IF;
  IF v_req.status = 'completed' THEN RETURN jsonb_build_object('changed', false, 'status', 'completed'); END IF;
  IF v_req.status NOT IN ('approved', 'processing') THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'not_approved', 'status', v_req.status);
  END IF;
  IF COALESCE(length(trim(p_reference)), 0) = 0 THEN
    RAISE EXCEPTION 'withdrawal_mark_paid: a payment reference (tx hash / Payoneer reference) is required' USING ERRCODE = 'check_violation';
  END IF;

  v_txn := withdrawal_payout(p_request_id);
  PERFORM money_fault_hook('withdrawal_mark_paid:after_payout');

  SELECT display_name, method_type = 'crypto' INTO v_display, v_is_crypto FROM withdrawal_methods WHERE id = v_req.method_id;
  UPDATE withdrawal_requests
     SET status = 'completed', completed_at = now(), processed_by = p_admin_id,
         payment_reference = trim(p_reference),
         transaction_hash = CASE WHEN COALESCE(v_is_crypto, false) THEN trim(p_reference) ELSE transaction_hash END,
         admin_notes = COALESCE(NULLIF(p_notes, ''), admin_notes), updated_at = now()
   WHERE id = p_request_id;

  PERFORM notify_once(v_req.user_id, 'withdrawal_completed', 'Withdrawal Sent',
    '$' || to_char(v_req.net_amount, 'FM999999990.00') || ' → ' || COALESCE(v_display, v_req.method_name) || ' — sent. Reference: ' || trim(p_reference),
    '/account/wallet', 'withdrawal:' || p_request_id::text || ':paid');

  RETURN jsonb_build_object('changed', true, 'status', 'completed', 'payout_txn_id', v_txn, 'user_id', v_req.user_id,
                            'amount', v_req.amount, 'net_amount', v_req.net_amount, 'method_name', v_req.method_name,
                            'display_name', v_display, 'reference', trim(p_reference));
END;
$$;
REVOKE ALL ON FUNCTION public.withdrawal_mark_paid(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_mark_paid(uuid, uuid, text, text) TO service_role;

-- Re-created from 20260914100000 verbatim + the deduped seller notification.
CREATE OR REPLACE FUNCTION public.withdrawal_reject(p_request_id uuid, p_admin_id uuid, p_reason text)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req  RECORD;
  v_txn  UUID;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_req FROM withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('request_id', p_request_id, 'changed', false, 'reason', 'not_found');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('request_id', p_request_id, 'changed', false, 'status', v_req.status);
  END IF;

  v_txn := withdrawal_reversal(p_request_id);
  PERFORM money_fault_hook('withdrawal_reject:after_reversal');

  UPDATE withdrawal_requests
     SET status = 'rejected', rejected_at = NOW(), processed_by = p_admin_id, admin_notes = p_reason, updated_at = NOW()
   WHERE id = p_request_id;
  PERFORM notify_once(v_req.user_id, 'withdrawal_rejected', 'Withdrawal Declined',
    '$' || to_char(v_req.amount, 'FM999999990.00') || ' — ' || COALESCE(NULLIF(p_reason, ''), 'not approved') || '. Funds stay in your wallet.',
    '/account/wallet', 'withdrawal:' || p_request_id::text || ':rejected');
  RETURN jsonb_build_object(
    'request_id', p_request_id, 'changed', true, 'status', 'rejected', 'reversal_txn_id', v_txn,
    'user_id', v_req.user_id, 'amount', v_req.amount, 'method_id', v_req.method_id, 'method_name', v_req.method_name);
END;
$$;
REVOKE ALL ON FUNCTION public.withdrawal_reject(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_reject(uuid, uuid, text) TO service_role;

-- ── 8. Payout details ───────────────────────────────────────────────────────
-- p_kind: 'crypto' (coin, chain, address) or 'payoneer' (email). The action
-- validates the address / email shape first; this is the single writer. A
-- real change stamps details_changed_at (the 48 h freeze); re-saving the same
-- value does not.
CREATE OR REPLACE FUNCTION public.seller_payout_details_set(
  p_seller_id uuid, p_kind text, p_coin text DEFAULT NULL, p_chain text DEFAULT NULL, p_address text DEFAULT NULL, p_email text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row     RECORD;
  v_changed BOOLEAN := false;
  v_freeze  INT;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  IF p_kind NOT IN ('crypto', 'payoneer') THEN
    RAISE EXCEPTION 'seller_payout_details_set: kind must be crypto or payoneer' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO seller_payout_details (seller_id) VALUES (p_seller_id) ON CONFLICT (seller_id) DO NOTHING;
  SELECT * INTO v_row FROM seller_payout_details WHERE seller_id = p_seller_id FOR UPDATE;

  IF p_kind = 'crypto' THEN
    IF COALESCE(length(trim(p_address)), 0) = 0 OR p_coin IS NULL OR p_chain IS NULL THEN
      RAISE EXCEPTION 'seller_payout_details_set: coin, chain and address are required' USING ERRCODE = 'check_violation';
    END IF;
    v_changed := v_row.crypto_address IS DISTINCT FROM trim(p_address) OR v_row.crypto_coin IS DISTINCT FROM lower(p_coin) OR v_row.crypto_chain IS DISTINCT FROM lower(p_chain);
    IF v_changed THEN
      UPDATE seller_payout_details
         SET crypto_coin = lower(p_coin), crypto_chain = lower(p_chain), crypto_address = trim(p_address),
             details_changed_at = now(), updated_at = now()
       WHERE seller_id = p_seller_id;
    END IF;
  ELSE
    IF COALESCE(length(trim(p_email)), 0) = 0 THEN
      RAISE EXCEPTION 'seller_payout_details_set: email is required' USING ERRCODE = 'check_violation';
    END IF;
    v_changed := lower(COALESCE(v_row.payoneer_email, '')) IS DISTINCT FROM lower(trim(p_email));
    IF v_changed THEN
      BEGIN
        UPDATE seller_payout_details
           SET payoneer_email = lower(trim(p_email)), details_changed_at = now(), updated_at = now()
         WHERE seller_id = p_seller_id;
      EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('saved', false, 'reason', 'email_in_use');
      END;
    END IF;
  END IF;

  SELECT payout_details_freeze_hours INTO v_freeze FROM platform_fee_settings WHERE id;
  SELECT * INTO v_row FROM seller_payout_details WHERE seller_id = p_seller_id;
  RETURN jsonb_build_object(
    'saved', true, 'changed', v_changed,
    'freeze_until', CASE WHEN v_row.details_changed_at IS NULL THEN NULL ELSE v_row.details_changed_at + make_interval(hours => COALESCE(v_freeze, 48)) END,
    'details', jsonb_build_object('crypto_coin', v_row.crypto_coin, 'crypto_chain', v_row.crypto_chain, 'crypto_address', v_row.crypto_address,
                                  'payoneer_email', v_row.payoneer_email, 'details_changed_at', v_row.details_changed_at));
END;
$$;
REVOKE ALL ON FUNCTION public.seller_payout_details_set(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_payout_details_set(uuid, text, text, text, text, text) TO service_role;

-- ── 9. Risk snapshot for the admin queue ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.withdrawal_risk_snapshot(p_seller_id uuid) RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_since     TIMESTAMPTZ := seller_since(p_seller_id);
  v_completed INT; v_completed_total NUMERIC; v_open_disputes INT;
  v_refunded_90 INT; v_completed_90 INT; v_changed TIMESTAMPTZ;
BEGIN
  SELECT count(*), COALESCE(SUM(seller_payout), 0) INTO v_completed, v_completed_total
    FROM orders WHERE seller_id = p_seller_id AND status = 'completed';
  SELECT count(*) INTO v_open_disputes FROM disputes
   WHERE seller_id = p_seller_id AND status NOT IN ('resolved_buyer_favor', 'resolved_seller_favor', 'resolved_partial', 'closed');
  SELECT count(*) FILTER (WHERE status = 'refunded'), count(*) FILTER (WHERE status IN ('completed', 'refunded'))
    INTO v_refunded_90, v_completed_90
    FROM orders WHERE seller_id = p_seller_id AND created_at > now() - interval '90 days';
  SELECT details_changed_at INTO v_changed FROM seller_payout_details WHERE seller_id = p_seller_id;
  RETURN jsonb_build_object(
    'seller_since', v_since,
    'account_age_days', CASE WHEN v_since IS NULL THEN NULL ELSE floor(extract(epoch FROM now() - v_since) / 86400)::int END,
    'completed_sales', v_completed, 'completed_sales_total', v_completed_total,
    'open_disputes', v_open_disputes,
    'refund_rate_90d', CASE WHEN v_completed_90 = 0 THEN 0 ELSE round(v_refunded_90::numeric / v_completed_90, 4) END,
    'refunded_90d', v_refunded_90, 'orders_90d', v_completed_90,
    'payout_details_changed_at', v_changed,
    'payout_details_changed_recently', v_changed IS NOT NULL AND v_changed > now() - interval '7 days',
    'matured_minor', seller_matured_balance(p_seller_id, 'USD'), 'frozen_minor', seller_frozen_balance(p_seller_id, 'USD'));
END;
$$;
REVOKE ALL ON FUNCTION public.withdrawal_risk_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_risk_snapshot(uuid) TO service_role;

-- ── 10. Admin-editable numbers with an audit row per change ─────────────────
-- The two `updated_by` provenance columns must never block a profile delete
-- (fee_config_audit already uses ON DELETE SET NULL): re-point both FKs.
ALTER TABLE public.platform_fee_settings DROP CONSTRAINT IF EXISTS platform_fee_settings_updated_by_fkey;
ALTER TABLE public.platform_fee_settings
  ADD CONSTRAINT platform_fee_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.order_completion_windows DROP CONSTRAINT IF EXISTS order_completion_windows_updated_by_fkey;
ALTER TABLE public.order_completion_windows
  ADD CONSTRAINT order_completion_windows_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.withdrawal_methods_set_fees(
  p_method_id uuid, p_admin_id uuid, p_fee_pct numeric, p_fee_fixed numeric, p_fee_min numeric, p_min numeric, p_max numeric, p_is_active boolean
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old RECORD; v_new RECORD;
BEGIN
  SELECT * INTO v_old FROM withdrawal_methods WHERE id = p_method_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal_methods_set_fees: method not found' USING ERRCODE = 'no_data_found'; END IF;
  IF p_fee_pct < 0 OR p_fee_pct > 50 OR p_fee_fixed < 0 OR p_fee_min < 0 OR p_min <= 0 OR p_max < p_min THEN
    RAISE EXCEPTION 'withdrawal_methods_set_fees: out of range (pct 0–50, fixed/min >= 0, 0 < minimum <= maximum)' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE withdrawal_methods
     SET fee_percentage = fee_round_cents(p_fee_pct), fee_fixed = fee_round_cents(p_fee_fixed), fee_min = fee_round_cents(p_fee_min),
         min_withdrawal = fee_round_cents(p_min), max_withdrawal = fee_round_cents(p_max), is_active = p_is_active, updated_at = now()
   WHERE id = p_method_id RETURNING * INTO v_new;
  INSERT INTO fee_config_audit (actor, scope, key, old_value, new_value)
  VALUES (p_admin_id, 'withdrawal_method', v_old.method_name,
    jsonb_build_object('fee_percentage', v_old.fee_percentage, 'fee_fixed', v_old.fee_fixed, 'fee_min', v_old.fee_min, 'min_withdrawal', v_old.min_withdrawal, 'max_withdrawal', v_old.max_withdrawal, 'is_active', v_old.is_active),
    jsonb_build_object('fee_percentage', v_new.fee_percentage, 'fee_fixed', v_new.fee_fixed, 'fee_min', v_new.fee_min, 'min_withdrawal', v_new.min_withdrawal, 'max_withdrawal', v_new.max_withdrawal, 'is_active', v_new.is_active));
  RETURN to_jsonb(v_new);
END;
$$;
REVOKE ALL ON FUNCTION public.withdrawal_methods_set_fees(uuid, uuid, numeric, numeric, numeric, numeric, numeric, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_methods_set_fees(uuid, uuid, numeric, numeric, numeric, numeric, numeric, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.platform_money_setting_set(p_admin_id uuid, p_key text, p_value integer) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old INT; v_row RECORD;
BEGIN
  IF p_key NOT IN ('completion_hold_hours', 'dispute_window_days', 'withdrawal_min_account_age_days', 'payout_details_freeze_hours') THEN
    RAISE EXCEPTION 'platform_money_setting_set: unknown key %', p_key USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_row FROM platform_fee_settings WHERE id FOR UPDATE;
  v_old := CASE p_key
    WHEN 'completion_hold_hours' THEN v_row.completion_hold_hours
    WHEN 'dispute_window_days' THEN v_row.dispute_window_days
    WHEN 'withdrawal_min_account_age_days' THEN v_row.withdrawal_min_account_age_days
    ELSE v_row.payout_details_freeze_hours END;
  EXECUTE format('UPDATE platform_fee_settings SET %I = $1, updated_at = now(), updated_by = $2 WHERE id', p_key) USING p_value, p_admin_id;
  INSERT INTO fee_config_audit (actor, scope, key, old_value, new_value)
  VALUES (p_admin_id, 'platform_setting', p_key, to_jsonb(v_old), to_jsonb(p_value));
  RETURN jsonb_build_object('key', p_key, 'old', v_old, 'new', p_value);
END;
$$;
REVOKE ALL ON FUNCTION public.platform_money_setting_set(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_money_setting_set(uuid, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.order_completion_window_set(p_admin_id uuid, p_category_type text, p_hours integer) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old INT;
BEGIN
  SELECT auto_complete_hours INTO v_old FROM order_completion_windows WHERE category_type = p_category_type FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_completion_window_set: unknown category type %', p_category_type USING ERRCODE = 'no_data_found'; END IF;
  UPDATE order_completion_windows SET auto_complete_hours = p_hours, updated_at = now(), updated_by = p_admin_id WHERE category_type = p_category_type;
  INSERT INTO fee_config_audit (actor, scope, key, old_value, new_value)
  VALUES (p_admin_id, 'completion_window', p_category_type, to_jsonb(v_old), to_jsonb(p_hours));
  RETURN jsonb_build_object('category_type', p_category_type, 'old', v_old, 'new', p_hours);
END;
$$;
REVOKE ALL ON FUNCTION public.order_completion_window_set(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_completion_window_set(uuid, text, integer) TO service_role;
