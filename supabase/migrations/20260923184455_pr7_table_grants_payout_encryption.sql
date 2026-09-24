-- ============================================================================
-- Fee engine PR 7, follow-up — (a) every table this PR created is service-role
-- only; (b) seller_payout_details secrets (crypto address, Payoneer email) are
-- stored encrypted (AES-256-GCM, app key PAYOUT_ENCRYPTION_KEY — same posture
-- as delivery codes) with an HMAC hash column for equality / uniqueness.
-- Idempotent: safe to re-run.
--
-- Grants found on the local stack (2026-09-23):
--   order_completion_windows  anon SELECT, authenticated SELECT  ← revoked here
--   seller_payout_details     authenticated SELECT               ← revoked here
--   order_dispute_events / seller_notice_sends: none (already service-only)
--   withdrawal_methods: legacy baseline blanket grant (pre-PR 7, not created
--   here; writes are blocked by its admin-only RLS policy) — unchanged.
-- Public readers (/sell/fees, the wallet page, admin pages) go through
-- server-side service-role reads; nothing in the browser reads these tables.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pr7_grants_encryption_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.pr7_grants_encryption_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pr7_grants_encryption_version() TO service_role;

-- ── (a) grants ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS order_completion_windows_read_all ON public.order_completion_windows;
REVOKE ALL ON TABLE public.order_completion_windows FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS seller_payout_details_owner_read ON public.seller_payout_details;
REVOKE ALL ON TABLE public.seller_payout_details FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.order_dispute_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.seller_notice_sends FROM PUBLIC, anon, authenticated;

-- ── (b) encrypted payout secrets ────────────────────────────────────────────
-- Plaintext columns are renamed *_plain and emptied by the backfill script
-- (scripts/backfill-payout-details-encryption.mjs — the key lives in the app,
-- not in Postgres). The RPCs below read and write ONLY the *_enc / *_hash
-- columns; a follow-up migration drops the *_plain columns once the backfill
-- has run everywhere.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seller_payout_details' AND column_name = 'crypto_address') THEN
    ALTER TABLE public.seller_payout_details RENAME COLUMN crypto_address TO crypto_address_plain;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seller_payout_details' AND column_name = 'payoneer_email') THEN
    ALTER TABLE public.seller_payout_details RENAME COLUMN payoneer_email TO payoneer_email_plain;
  END IF;
END $$;
ALTER TABLE public.seller_payout_details DROP CONSTRAINT IF EXISTS seller_payout_details_crypto_shape;
ALTER TABLE public.seller_payout_details DROP CONSTRAINT IF EXISTS seller_payout_details_crypto_address_check;
ALTER TABLE public.seller_payout_details DROP CONSTRAINT IF EXISTS seller_payout_details_payoneer_email_check;
DROP INDEX IF EXISTS public.seller_payout_details_payoneer_email_uidx;

ALTER TABLE public.seller_payout_details
  ADD COLUMN IF NOT EXISTS crypto_address_enc  text,
  ADD COLUMN IF NOT EXISTS crypto_address_hash text CHECK (crypto_address_hash IS NULL OR crypto_address_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN IF NOT EXISTS payoneer_email_enc  text,
  ADD COLUMN IF NOT EXISTS payoneer_email_hash text CHECK (payoneer_email_hash IS NULL OR payoneer_email_hash ~ '^[0-9a-f]{64}$');
COMMENT ON COLUMN public.seller_payout_details.crypto_address_enc IS 'AES-256-GCM ciphertext (src/lib/crypto/payout-encryption.ts, PAYOUT_ENCRYPTION_KEY). Decrypted server-side only.';
COMMENT ON COLUMN public.seller_payout_details.crypto_address_hash IS 'HMAC-SHA256 of the normalised address — equality (change detection) only, never reversible.';
COMMENT ON COLUMN public.seller_payout_details.payoneer_email_enc IS 'AES-256-GCM ciphertext of the lower-cased email. Decrypted server-side only.';
COMMENT ON COLUMN public.seller_payout_details.payoneer_email_hash IS 'HMAC-SHA256 of the lower-cased email — uniqueness (one Payoneer account per seller) and change detection.';

ALTER TABLE public.seller_payout_details
  ADD CONSTRAINT seller_payout_details_crypto_shape CHECK (
    (crypto_address_enc IS NULL AND crypto_address_hash IS NULL AND crypto_coin IS NULL AND crypto_chain IS NULL) OR
    (crypto_address_enc IS NOT NULL AND crypto_address_hash IS NOT NULL AND crypto_coin IS NOT NULL AND crypto_chain IS NOT NULL)),
  ADD CONSTRAINT seller_payout_details_payoneer_shape CHECK (
    (payoneer_email_enc IS NULL AND payoneer_email_hash IS NULL) OR (payoneer_email_enc IS NOT NULL AND payoneer_email_hash IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS seller_payout_details_payoneer_hash_uidx
  ON public.seller_payout_details (payoneer_email_hash) WHERE payoneer_email_hash IS NOT NULL;

-- Writer: ciphertext + hash come from the server action (validated + encrypted
-- there); the RPC decides "changed" by hash and stamps the freeze.
DROP FUNCTION IF EXISTS public.seller_payout_details_set(uuid, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.seller_payout_details_set(
  p_seller_id uuid, p_kind text,
  p_coin text DEFAULT NULL, p_chain text DEFAULT NULL, p_address_enc text DEFAULT NULL, p_address_hash text DEFAULT NULL,
  p_email_enc text DEFAULT NULL, p_email_hash text DEFAULT NULL
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
    IF COALESCE(length(p_address_enc), 0) = 0 OR COALESCE(length(p_address_hash), 0) = 0 OR p_coin IS NULL OR p_chain IS NULL THEN
      RAISE EXCEPTION 'seller_payout_details_set: coin, chain, encrypted address and hash are required' USING ERRCODE = 'check_violation';
    END IF;
    v_changed := v_row.crypto_address_hash IS DISTINCT FROM p_address_hash OR v_row.crypto_coin IS DISTINCT FROM lower(p_coin) OR v_row.crypto_chain IS DISTINCT FROM lower(p_chain);
    IF v_changed THEN
      UPDATE seller_payout_details
         SET crypto_coin = lower(p_coin), crypto_chain = lower(p_chain),
             crypto_address_enc = p_address_enc, crypto_address_hash = p_address_hash, crypto_address_plain = NULL,
             details_changed_at = now(), updated_at = now()
       WHERE seller_id = p_seller_id;
    END IF;
  ELSE
    IF COALESCE(length(p_email_enc), 0) = 0 OR COALESCE(length(p_email_hash), 0) = 0 THEN
      RAISE EXCEPTION 'seller_payout_details_set: encrypted email and hash are required' USING ERRCODE = 'check_violation';
    END IF;
    v_changed := v_row.payoneer_email_hash IS DISTINCT FROM p_email_hash;
    IF v_changed THEN
      BEGIN
        UPDATE seller_payout_details
           SET payoneer_email_enc = p_email_enc, payoneer_email_hash = p_email_hash, payoneer_email_plain = NULL,
               details_changed_at = now(), updated_at = now()
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
    'details', jsonb_build_object('crypto_coin', v_row.crypto_coin, 'crypto_chain', v_row.crypto_chain,
                                  'crypto_address_enc', v_row.crypto_address_enc, 'payoneer_email_enc', v_row.payoneer_email_enc,
                                  'details_changed_at', v_row.details_changed_at));
END;
$$;
REVOKE ALL ON FUNCTION public.seller_payout_details_set(uuid, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_payout_details_set(uuid, text, text, text, text, text, text, text) TO service_role;

-- Quote: "details missing" now keys on the hash columns.
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

-- Request: payment_details carries the CIPHERTEXT (wallet_address_enc /
-- payoneer_email_enc) plus coin/network; the admin queue decrypts server-side.
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
  PERFORM pg_advisory_xact_lock(hashtextextended('withdrawal_request:' || p_seller_id::text, 0));

  v_q := withdrawal_quote(p_seller_id, p_method_id, p_amount);
  IF NOT (v_q->>'ok')::boolean THEN
    RETURN jsonb_build_object('requested', false, 'quote', v_q);
  END IF;
  v_amount := (v_q->>'amount')::numeric;

  SELECT * INTO v_m FROM withdrawal_methods WHERE id = p_method_id;
  SELECT * INTO v_details FROM seller_payout_details WHERE seller_id = p_seller_id;
  v_payment := CASE WHEN v_m.method_type = 'crypto'
    THEN jsonb_build_object('wallet_address_enc', v_details.crypto_address_enc, 'network', v_details.crypto_chain, 'coin', v_details.crypto_coin)
    ELSE jsonb_build_object('payoneer_email_enc', v_details.payoneer_email_enc) END;

  INSERT INTO withdrawal_requests
    (user_id, amount, method_id, method_name, fee_amount, fee_percentage, fee_fixed, fee_min, net_amount, payment_details, quote, status)
  VALUES
    (p_seller_id, v_amount, p_method_id, v_m.method_name,
     (v_q->>'fee_amount')::numeric, (v_q->>'fee_pct')::numeric, (v_q->>'fee_fixed')::numeric, (v_q->>'fee_min')::numeric,
     (v_q->>'net')::numeric, v_payment, v_q, 'pending')
  RETURNING id INTO v_id;

  PERFORM withdrawal_debit(p_seller_id, ROUND(v_amount * 100)::bigint, 'withdrawal:' || v_id::text, 'WITHDRAWAL_REQUESTED');
  PERFORM money_fault_hook('withdrawal_request:after_hold');

  PERFORM notify_once(p_seller_id, 'withdrawal_requested', 'Withdrawal Requested',
    '$' || to_char(v_amount, 'FM999999990.00') || ' → ' || v_m.display_name || ' — you receive $' || (v_q->>'net') || ' after the $' || (v_q->>'fee_amount') || ' fee. We review requests within 1–2 business days.',
    '/account/wallet', 'withdrawal:' || v_id::text || ':requested');

  RETURN jsonb_build_object('requested', true, 'request_id', v_id, 'quote', v_q, 'method_name', v_m.method_name, 'display_name', v_m.display_name);
END;
$$;
