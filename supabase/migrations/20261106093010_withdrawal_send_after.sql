-- A withdrawal asked for during the payout-details wait (owner, 2026-11-06).
--
-- Adding or changing a payout method starts a 24-hour wait, so a stolen login can't
-- move money to a new address before the owner sees the email. Until now the wait
-- refused the request outright. Now the seller can ask straight away: the money is set
-- aside as usual and the request carries send_after, the moment the wait ends. Staff
-- can't approve it before then, and the seller can cancel it until then.
--
-- withdrawal_approve is the only way out of 'pending' towards a payout (mark_paid
-- needs 'approved'), so the check there covers the whole path.
--
-- Bodies are the live ones from pg_get_functiondef (2026-11-06), changed only where
-- marked. Interior hook money_fault_hook('withdrawal_request:after_hold') is unchanged.

ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS send_after timestamptz;
COMMENT ON COLUMN public.withdrawal_requests.send_after IS
  'Set when the request was made during the payout-details wait: when that wait ends. withdrawal_approve refuses before this.';

-- 24 hours, the owner's number and already the live value. The default was still 48,
-- so a new stack disagreed with production.
ALTER TABLE public.platform_fee_settings ALTER COLUMN payout_details_freeze_hours SET DEFAULT 24;
UPDATE public.platform_fee_settings SET payout_details_freeze_hours = 24 WHERE payout_details_freeze_hours = 48;

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
  v_waiting   BOOLEAN;  -- new
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
  -- new: the wait no longer refuses. Every other rule still applies.
  v_waiting := NOT (v_gate->>'eligible')::boolean AND v_gate->>'reason' = 'payout_details_freeze';

  IF NOT (v_gate->>'eligible')::boolean AND NOT v_waiting THEN
    v_refusal := v_gate->>'reason';
    v_message := CASE v_refusal
      WHEN 'kyc_required' THEN v_gate->>'message'
      WHEN 'not_a_seller' THEN 'Store credit is spent at checkout. To withdraw it, contact support@dropmarket.gg.'
      WHEN 'account_age' THEN 'Withdrawals open ' || COALESCE(v_gate->>'min_age_days', '30') || ' days after your seller account is approved — from ' || to_char((v_gate->>'unlock_at')::timestamptz, 'DD Mon YYYY') || '.'
      ELSE COALESCE(v_gate->>'message', 'Withdrawals are not available on this account yet.') END;
  ELSIF v_matured < 0 THEN
    v_refusal := 'negative_balance';
    v_message := 'Your balance is below zero after a refund. Withdrawals reopen once new sales bring it back above zero.';
  ELSIF v_open IS NOT NULL THEN
    v_refusal := 'open_withdrawal';
    v_message := 'You already have a withdrawal in progress. Wait for it to complete or cancel it first.';
    v_extra := jsonb_build_object('open_request_id', v_open);
  ELSIF (v_m.method_type = 'crypto' AND (v_details.crypto_address_hash IS NULL OR v_details.crypto_chain IS DISTINCT FROM v_m.chain OR v_details.crypto_coin IS DISTINCT FROM v_m.coin))
     OR (v_m.method_name = 'payoneer' AND v_details.payoneer_email_hash IS NULL) THEN
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

  -- new: when a request made now would go out.
  IF v_waiting THEN
    v_extra := v_extra || jsonb_build_object('send_after', v_gate->'freeze_until');
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

CREATE OR REPLACE FUNCTION public.withdrawal_request(p_seller_id uuid, p_method_id uuid, p_amount numeric) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_q        JSONB;
  v_m        RECORD;
  v_details  RECORD;
  v_payment  JSONB;
  v_id       UUID;
  v_amount   NUMERIC;
  v_after    TIMESTAMPTZ;  -- new
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  PERFORM pg_advisory_xact_lock(hashtextextended('withdrawal_request:' || p_seller_id::text, 0));

  v_q := withdrawal_quote(p_seller_id, p_method_id, p_amount);
  IF NOT (v_q->>'ok')::boolean THEN
    RETURN jsonb_build_object('requested', false, 'quote', v_q);
  END IF;
  v_amount := (v_q->>'amount')::numeric;
  v_after := (v_q->>'send_after')::timestamptz;  -- new

  SELECT * INTO v_m FROM withdrawal_methods WHERE id = p_method_id;
  SELECT * INTO v_details FROM seller_payout_details WHERE seller_id = p_seller_id;
  v_payment := CASE WHEN v_m.method_type = 'crypto'
    THEN jsonb_build_object('wallet_address_enc', v_details.crypto_address_enc, 'network', v_details.crypto_chain, 'coin', v_details.crypto_coin)
    ELSE jsonb_build_object('payoneer_email_enc', v_details.payoneer_email_enc) END;

  INSERT INTO withdrawal_requests
    (user_id, amount, method_id, method_name, fee_amount, fee_percentage, fee_fixed, fee_min, net_amount, payment_details, quote, status, send_after)
  VALUES
    (p_seller_id, v_amount, p_method_id, v_m.method_name,
     (v_q->>'fee_amount')::numeric, (v_q->>'fee_pct')::numeric, (v_q->>'fee_fixed')::numeric, (v_q->>'fee_min')::numeric,
     (v_q->>'net')::numeric, v_payment, v_q, 'pending', v_after)
  RETURNING id INTO v_id;

  PERFORM withdrawal_debit(p_seller_id, ROUND(v_amount * 100)::bigint, 'withdrawal:' || v_id::text, 'WITHDRAWAL_REQUESTED');
  PERFORM money_fault_hook('withdrawal_request:after_hold');

  PERFORM notify_once(p_seller_id, 'withdrawal_requested', 'Withdrawal Requested',
    '$' || to_char(v_amount, 'FM999999990.00') || ' → ' || v_m.display_name || ' — you receive $' || (v_q->>'net') || ' after the $' || (v_q->>'fee_amount') || ' fee. '
      || CASE WHEN v_after IS NULL
           THEN 'We review requests within 1–2 business days.'
           ELSE 'You changed your payout details, so we send this after ' || to_char(v_after AT TIME ZONE 'UTC', 'DD Mon HH24:MI') || ' UTC. You can cancel it until then.' END,
    '/account/wallet', 'withdrawal:' || v_id::text || ':requested');

  RETURN jsonb_build_object('requested', true, 'request_id', v_id, 'quote', v_q, 'method_name', v_m.method_name, 'display_name', v_m.display_name, 'send_after', v_after);
END;
$$;
REVOKE ALL ON FUNCTION public.withdrawal_request(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_request(uuid, uuid, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.withdrawal_approve(p_request_id uuid, p_admin_id uuid, p_notes text DEFAULT NULL) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req RECORD; v_display TEXT;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT * INTO v_req FROM withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('changed', false, 'reason', 'not_found'); END IF;
  IF v_req.status <> 'pending' THEN RETURN jsonb_build_object('changed', false, 'status', v_req.status); END IF;
  -- new: not before the payout-details wait ends.
  IF v_req.send_after IS NOT NULL AND v_req.send_after > now() THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'waiting', 'send_after', v_req.send_after);
  END IF;
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
