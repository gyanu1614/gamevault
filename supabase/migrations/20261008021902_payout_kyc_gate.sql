-- Payout KYC gate (open seller signup, 2026-10-08).
--
-- Sellers now list BEFORE identity verification (/founding, 4 steps, no ID).
-- Money must not leave the platform until they verify, so the withdrawal gate
-- refuses an unverified seller FIRST — before account age, freeze, balance.
--
--   · The flag is profiles.is_verified: the same column that shows the blue
--     Verified badge, so "has the badge" ⇔ "may withdraw". Every seller
--     approved through the old application already has it (approval sets it;
--     20260907000000 backfilled the rest). Open-signup sellers get it only
--     when the withdrawal-time KYC (later PR) clears them.
--   · Fail closed: NULL is unverified.
--   · The gate carries its own `message` so the wallet UI can show the DB's
--     text for any reason it does not know yet (safe to push before deploy).
--
-- Replaces two functions in place (bodies verbatim from 20260930005449 plus
-- the new branch). No new tables, grants unchanged (service_role only).

CREATE OR REPLACE FUNCTION public.seller_withdrawal_gate(p_seller_id uuid) RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role     TEXT;
  v_verified BOOLEAN;
  v_since    TIMESTAMPTZ;
  v_days     INT;
  v_freeze   INT;
  v_unlock   TIMESTAMPTZ;
  v_changed  TIMESTAMPTZ;
  v_until    TIMESTAMPTZ;
BEGIN
  SELECT role, is_verified INTO v_role, v_verified FROM profiles WHERE id = p_seller_id;
  IF v_role IS DISTINCT FROM 'seller' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_a_seller', 'seller_since', NULL,
                              'unlock_at', NULL, 'min_age_days', NULL, 'freeze_until', NULL);
  END IF;
  -- KYC first. An unverified seller (open signup) cannot withdraw at all.
  IF COALESCE(v_verified, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'kyc_required', 'seller_since', NULL,
                              'unlock_at', NULL, 'min_age_days', NULL, 'freeze_until', NULL,
                              'message', 'Verify your identity before your first withdrawal. Verification opens in your wallet soon; your balance stays here until then.');
  END IF;
  v_since := seller_since(p_seller_id);
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
REVOKE ALL ON FUNCTION public.seller_withdrawal_gate(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_withdrawal_gate(uuid) TO service_role;

-- withdrawal_quote: body from 20260930005449 verbatim + the kyc_required message (read off the gate).
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
      WHEN 'kyc_required' THEN v_gate->>'message'
      WHEN 'not_a_seller' THEN 'Store credit is spent at checkout. To withdraw it, contact support@dropmarket.gg.'
      WHEN 'account_age' THEN 'Withdrawals open ' || COALESCE(v_gate->>'min_age_days', '30') || ' days after your seller account is approved — from ' || to_char((v_gate->>'unlock_at')::timestamptz, 'DD Mon YYYY') || '.'
      ELSE 'You changed your payout details recently. For your security, withdrawals reopen on ' || to_char((v_gate->>'freeze_until')::timestamptz, 'DD Mon YYYY HH24:MI') || ' UTC.' END;
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
