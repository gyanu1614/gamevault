-- ─────────────────────────────────────────────────────────────────────────────
-- Checkout B4 — EU Payssion methods (docs/handoff/checkout-b4.md,
-- docs/payments/eu-methods-probe.md)
--
-- 1. payment_method_fees.min_total_minor — the provider's MINIMUM charge in
--    fee_currency (Payssion answers 417 below it: "must be more than 1.00 EUR"
--    for eps_at / mbway_pt). B3 seeded that "€1 min" as min_fee_minor (a
--    minimum FEE of €1 on every order) — a misread; moved here, min_fee → 0.
-- 2. bancomat_it → bancomatpay_it: the probe answered 405 "pm_id not found"
--    for the B3 seed key; bancomatpay_it is the real pm_id (200).
-- 3. buyer_fee_quote: new refusal reason `under_min` (same signature — no
--    shim; old code maps an unknown reason to the generic refusal copy).
-- 4. order_create_pending (19-arg): re-checks the minimum on the ACTUAL
--    provider charge (after promo + wallet) and raises before the attempt
--    row — the whole transaction rolls back. Same signature — no shim; the
--    21-arg compat shim still delegates here unchanged.
-- No local-currency charging: every probed method takes a USD charge and
-- Payssion converts on its page. Orders / attempts / charges stay USD.
-- Idempotent: re-runnable.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.buyer_method_fees_version() RETURNS integer
  LANGUAGE sql IMMUTABLE AS $$ SELECT 2 $$;

-- ── 1. min_total_minor ───────────────────────────────────────────────────────
ALTER TABLE public.payment_method_fees
  ADD COLUMN IF NOT EXISTS min_total_minor bigint CHECK (min_total_minor IS NULL OR min_total_minor > 0);
COMMENT ON COLUMN public.payment_method_fees.min_total_minor IS
  'Checkout B4: the provider''s minimum charge, in fee_currency minor units (Payssion 417s below it). NULL = none. buyer_fee_quote refuses under_min on subtotal + fee; order_create_pending re-checks the actual charge. Both with 5% headroom over currency_rates.';

UPDATE public.payment_method_fees
   SET min_fee_minor = 0, min_total_minor = 100,
       note = 'Sheet: 3.75% + €0.45; Payssion minimum charge €1.00 (417 below, probed 2026-09-24); pm_id probe 200 2026-09-24'
 WHERE method = 'eps_at';
UPDATE public.payment_method_fees
   SET min_fee_minor = 0, min_total_minor = 100,
       note = 'Sheet: 2.75% + €0.25; Payssion minimum charge €1.00 (417 below, probed 2026-09-24); pm_id probe 200 2026-09-24'
 WHERE method = 'mbway_pt';

-- ── 2. bancomat_it → bancomatpay_it (the real pm_id) ─────────────────────────
DELETE FROM public.payment_method_fees WHERE method = 'bancomat_it'
   AND EXISTS (SELECT 1 FROM public.payment_method_fees WHERE method = 'bancomatpay_it');
UPDATE public.payment_method_fees
   SET method = 'bancomatpay_it',
       note = 'Sheet: 2.75% + €0.20; pm_id probe 200 2026-09-24 (B3 seed key bancomat_it was not a pm_id — 405)'
 WHERE method = 'bancomat_it';
-- A database that never had the B3 seed row still gets the method.
INSERT INTO public.payment_method_fees
  (method, label, provider, fee_currency, provider_pct, provider_fixed_minor, fx_markup_pct, buffer_pct, floor_pct, min_fee_minor, max_total_minor, refundable, instant_clearing, selectable, currencies, note)
VALUES ('bancomatpay_it', 'BANCOMAT Pay', 'payssion', 'EUR', 2.75, 20, 0, 1, 5, 0, NULL, true, true, true, '{USD,EUR,GBP}', 'Sheet: 2.75% + €0.20; pm_id probe 200 2026-09-24')
ON CONFLICT (method) DO NOTHING;

UPDATE public.payment_method_fees SET note = 'Sheet: 2.5% + €0.35; pm_id probe 200 2026-09-24 (USD and EUR)' WHERE method = 'trustly';
UPDATE public.payment_method_fees SET note = 'Sheet: 4.75% + 0.55 zł; pm_id probe 200 2026-09-24 (USD and PLN)' WHERE method = 'blik_pl';
UPDATE public.payment_method_fees SET note = 'Sheet: 4.75% + 0.55 zł; pm_id probe 200 2026-09-24' WHERE method = 'p24_pl';
UPDATE public.payment_method_fees SET note = 'Sheet: 4.75% + 3.5 Kč; pm_id probe 200 2026-09-24 (USD and CZK)' WHERE method = 'payu_cz';
UPDATE public.payment_method_fees SET note = 'Sheet: 12.5%, cap €250 (OURS to enforce — Payssion accepted $320 at create), no provider refunds → wallet credit only; pm_id probe 200 2026-09-24 (491 cleared)' WHERE method = 'paysafecard';

-- ── 3. buyer_fee_quote — + under_min ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.buyer_fee_quote(p_method text, p_subtotal_minor bigint, p_currency text)
  RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r            public.payment_method_fees%ROWTYPE;
  v_cur        char(3) := UPPER(COALESCE(p_currency, 'USD'))::char(3);
  v_rate_fee   numeric;   -- usd per unit of fee_currency
  v_rate_quote numeric;   -- usd per unit of the quote currency
  v_conv       numeric;   -- fee_currency minor → quote-currency minor
  v_sub        numeric := GREATEST(COALESCE(p_subtotal_minor, 0), 0);
  v_fixed      numeric;
  v_denom      numeric;
  v_gross      numeric;
  v_fee        numeric;
  v_total      numeric;
  v_fee_minor  bigint;
  v_total_minor bigint;
  v_pct        numeric;
  refusal      jsonb;
BEGIN
  SELECT * INTO r FROM public.payment_method_fees WHERE method = p_method;
  refusal := jsonb_build_object('ok', false, 'method', p_method, 'fee_minor', NULL, 'total_minor', NULL,
                                'pct_effective', NULL, 'fee_currency', NULL, 'refundable', NULL, 'instant_clearing', NULL);
  IF NOT FOUND THEN
    RETURN refusal || jsonb_build_object('reason', 'no_fee_row');
  END IF;
  refusal := refusal || jsonb_build_object('fee_currency', r.fee_currency, 'refundable', r.refundable, 'instant_clearing', r.instant_clearing, 'label', r.label, 'provider', r.provider);
  IF NOT r.selectable THEN
    RETURN refusal || jsonb_build_object('reason', 'not_selectable');
  END IF;
  IF NOT (v_cur::text = ANY (r.currencies)) THEN
    RETURN refusal || jsonb_build_object('reason', 'currency_unsupported');
  END IF;
  SELECT usd_per_unit INTO v_rate_fee   FROM public.currency_rates WHERE currency = r.fee_currency;
  SELECT usd_per_unit INTO v_rate_quote FROM public.currency_rates WHERE currency = v_cur;
  IF v_rate_fee IS NULL OR v_rate_quote IS NULL THEN
    RETURN refusal || jsonb_build_object('reason', 'fx_rate_missing');
  END IF;
  -- Every supported currency is 2-dp, so minor units convert by the rate alone.
  v_conv  := v_rate_fee / v_rate_quote;
  v_fixed := r.provider_fixed_minor * v_conv;
  v_denom := 1 - (r.provider_pct + r.fx_markup_pct + r.buffer_pct) / 100;
  v_gross := (v_sub + v_fixed) / v_denom;
  v_fee   := GREATEST(r.floor_pct / 100 * v_sub, v_gross - v_sub);
  v_fee   := GREATEST(v_fee, r.min_fee_minor * v_conv);
  v_fee_minor   := (public.fee_round_cents(v_fee / 100) * 100)::bigint;
  v_total_minor := p_subtotal_minor + v_fee_minor;
  IF r.max_total_minor IS NOT NULL AND (v_total_minor / v_conv) > r.max_total_minor THEN
    RETURN refusal || jsonb_build_object('reason', 'over_cap');
  END IF;
  -- B4: the provider's minimum charge (Payssion answers 417 below it, at ITS
  -- own FX rate) — refused here so the tile is never shown for an order that
  -- would fail at create. The 5% headroom covers the gap between currency_rates
  -- and the provider's rate; order_create_pending re-checks the actual charge.
  IF r.min_total_minor IS NOT NULL AND (v_total_minor / v_conv) < r.min_total_minor * 1.05 THEN
    RETURN refusal || jsonb_build_object('reason', 'under_min');
  END IF;
  v_pct := CASE WHEN v_sub > 0 THEN ROUND(v_fee_minor / v_sub * 100, 2) ELSE NULL END;
  RETURN jsonb_build_object(
    'ok', true, 'reason', NULL, 'method', r.method, 'label', r.label, 'provider', r.provider,
    'fee_minor', v_fee_minor, 'total_minor', v_total_minor, 'pct_effective', v_pct,
    'fee_currency', r.fee_currency, 'refundable', r.refundable, 'instant_clearing', r.instant_clearing);
END;
$$;
REVOKE ALL ON FUNCTION public.buyer_fee_quote(text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buyer_fee_quote(text, bigint, text) TO service_role;
COMMENT ON FUNCTION public.buyer_fee_quote(text, bigint, text) IS
  'Checkout B3/B4: THE buyer processing-fee quote. ok=false carries reason ∈ {no_fee_row, not_selectable, currency_unsupported, fx_rate_missing, over_cap, under_min}. Service-role only; the page and createCheckout reach it through eligibleMethods.';

-- ── 4. order_create_pending (19-arg) — the minimum on the actual charge ──────
CREATE OR REPLACE FUNCTION public.order_create_pending(
  p_buyer_id uuid, p_seller_id uuid, p_listing_id uuid, p_quantity integer,
  p_unit_price numeric, p_subtotal numeric,
  p_platform_fee_rate numeric, p_platform_fee numeric,
  p_seller_payout numeric,
  p_seller_commission_pct numeric, p_seller_fee_trace jsonb,
  p_currency text, p_promo_code_id uuid, p_promo_discount numeric,
  p_wallet_minor bigint, p_provider text, p_pm_id text,
  p_fallback_expires_at timestamptz,
  p_buyer_fee_method text)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id     uuid;
  v_order_number text;
  v_currency     char(3) := UPPER(COALESCE(p_currency, 'USD'))::char(3);
  v_subtotal_minor bigint := ROUND(COALESCE(p_subtotal, 0) * 100)::bigint;
  v_quote        jsonb;
  v_fee_minor    bigint;
  v_fee_pct      numeric;
  v_total_minor  bigint;
  v_balance      bigint  := 0;
  v_applied      bigint  := 0;
  v_charge       bigint;
  v_attempt_id   uuid;
  v_constraint   text;
  v_tries        int := 0;
  v_min_total    bigint;
  v_min_cur      char(3);
  v_rate_fee     numeric;
  v_rate_quote   numeric;
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);

  -- 0. The buyer fee: ONE quote, from the table, refused loudly when the
  --    method has no row / is hidden / breaches its cap. Nothing is written
  --    before this line, so a refusal leaves no trace.
  v_quote := public.buyer_fee_quote(p_buyer_fee_method, v_subtotal_minor, v_currency);
  IF NOT COALESCE((v_quote->>'ok')::boolean, false) THEN
    RAISE EXCEPTION 'buyer_fee_quote: % (%)', COALESCE(v_quote->>'reason', 'refused'), COALESCE(p_buyer_fee_method, '<null>')
      USING ERRCODE = 'P0001';
  END IF;
  v_fee_minor   := (v_quote->>'fee_minor')::bigint;
  v_fee_pct     := COALESCE((v_quote->>'pct_effective')::numeric, 0);
  v_total_minor := GREATEST(
    v_subtotal_minor + ROUND(COALESCE(p_platform_fee, 0) * 100)::bigint + v_fee_minor
      - ROUND(COALESCE(p_promo_discount, 0) * 100)::bigint,
    0);

  PERFORM money_fault_hook('order_create_pending:after_quote');

  -- 1. The order. orders_order_number_key: the BEFORE INSERT trigger drew a
  --    number that already exists — retry the INSERT exactly once (the
  --    trigger draws again). Every other unique violation (the buyer's own
  --    one_pending_order_per_buyer_listing double-submit included) is
  --    re-raised untouched so the caller reads the constraint name.
  LOOP
    BEGIN
      INSERT INTO orders (
        buyer_id, seller_id, listing_id, quantity, unit_price, subtotal,
        platform_fee_rate, payment_processing_fee_rate, platform_fee, payment_processing_fee,
        total_amount, seller_payout, seller_commission_pct, seller_fee_trace,
        buyer_fee_pct, buyer_fee_amount, buyer_fee_method,
        currency, status, escrow_status, promo_discount, promo_code_id,
        payment_expires_at, payment_provider)
      VALUES (
        p_buyer_id, p_seller_id, p_listing_id, p_quantity, p_unit_price, p_subtotal,
        p_platform_fee_rate, v_fee_pct, p_platform_fee, v_fee_minor / 100.0,
        v_total_minor / 100.0, p_seller_payout, p_seller_commission_pct, p_seller_fee_trace,
        v_fee_pct, v_fee_minor / 100.0, p_buyer_fee_method,
        v_currency, 'pending', 'pending', COALESCE(p_promo_discount, 0), p_promo_code_id,
        p_fallback_expires_at, p_provider)
      RETURNING id, order_number INTO v_order_id, v_order_number;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint = 'orders_order_number_key' AND v_tries < 1 THEN
        v_tries := v_tries + 1;
        CONTINUE;
      END IF;
      RAISE;
    END;
  END LOOP;

  PERFORM money_fault_hook('order_create_pending:after_order');

  -- 2. Promo usage (PAY-014): the cap binds under the promo row lock; a
  --    refusal raises and the whole order rolls back — no cancelled order,
  --    no discount granted.
  IF p_promo_code_id IS NOT NULL AND COALESCE(p_promo_discount, 0) > 0 THEN
    PERFORM promo_usage_record(p_promo_code_id, v_order_id, p_buyer_id, p_promo_discount);
  END IF;

  PERFORM money_fault_hook('order_create_pending:after_promo');

  -- 3. Wallet hold (PAY-001 lock inside wallet_spend): clamped to the
  --    balance and the total. If the balance moved between the read and the
  --    lock, wallet_spend raises and the order rolls back with it.
  IF COALESCE(p_wallet_minor, 0) > 0 THEN
    v_balance := COALESCE(user_wallet_balance(p_buyer_id, v_currency), 0);
    v_applied := LEAST(p_wallet_minor, v_balance, v_total_minor);
    IF v_applied > 0 THEN
      PERFORM wallet_spend(p_buyer_id, v_applied, v_currency, 'escrow_held',
                           'checkout_wallet:' || v_order_id::text, 'CHECKOUT_WALLET_CREDIT', v_order_id);
    ELSE
      v_applied := 0;
    END IF;
  END IF;

  PERFORM money_fault_hook('order_create_pending:after_wallet');

  -- 4. The attempt: only when something is left to charge. A fully
  --    wallet-paid order is confirmed by the caller (order_confirm_payment)
  --    and never had a provider charge. A 'wallet' quote with money left to
  --    charge means the balance moved under the buyer: there is no provider
  --    to send the remainder to, so the order rolls back (same message
  --    class as a wallet_spend shortfall — the caller maps it).
  v_charge := v_total_minor - v_applied;
  IF v_charge > 0 AND p_buyer_fee_method = 'wallet' THEN
    RAISE EXCEPTION 'wallet_spend: insufficient balance — store credit no longer covers this order (short % minor)', v_charge
      USING ERRCODE = 'P0001';
  END IF;
  -- B4: the provider's minimum charge, checked on what the provider will
  -- actually be asked for (after promo and wallet), in the row's fee
  -- currency, with the same 5% headroom as buyer_fee_quote. Raising here
  -- rolls back the order, the promo usage and the wallet hold — nothing
  -- is left behind, and the caller maps the reason like every other refusal.
  IF v_charge > 0 THEN
    SELECT f.min_total_minor, f.fee_currency INTO v_min_total, v_min_cur
      FROM payment_method_fees f WHERE f.method = p_buyer_fee_method;
    IF v_min_total IS NOT NULL THEN
      SELECT usd_per_unit INTO v_rate_fee   FROM currency_rates WHERE currency = v_min_cur;
      SELECT usd_per_unit INTO v_rate_quote FROM currency_rates WHERE currency = v_currency;
      IF v_rate_fee IS NULL OR v_rate_quote IS NULL THEN
        RAISE EXCEPTION 'buyer_fee_quote: fx_rate_missing (%)', p_buyer_fee_method USING ERRCODE = 'P0001';
      END IF;
      IF (v_charge * v_rate_quote / v_rate_fee) < v_min_total * 1.05 THEN
        RAISE EXCEPTION 'buyer_fee_quote: under_min (%)', p_buyer_fee_method USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  PERFORM money_fault_hook('order_create_pending:after_min_check');

  IF v_charge > 0 THEN
    INSERT INTO payment_attempts (order_id, provider, pm_id, status, amount_minor, wallet_minor,
                                  order_total_minor, currency, expires_at)
    VALUES (v_order_id, p_provider, p_pm_id, 'created', v_charge, v_applied,
            v_total_minor, v_currency, p_fallback_expires_at)
    RETURNING id INTO v_attempt_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'attempt_id', v_attempt_id,
    'total_minor', v_total_minor,
    'buyer_fee_minor', v_fee_minor,
    'buyer_fee_pct', v_fee_pct,
    'wallet_applied_minor', v_applied,
    'charge_minor', v_charge);
END;
$$;
REVOKE ALL ON FUNCTION public.order_create_pending(uuid, uuid, uuid, integer, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, uuid, numeric, bigint, text, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_create_pending(uuid, uuid, uuid, integer, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, uuid, numeric, bigint, text, text, timestamptz, text) TO service_role;
