-- Buyer service fee (docs/design/buyer-fee-refund-policy.md, owner 2026-09-29).
--
-- ONE quote (buyer_fee_quote) now computes the whole buyer fee:
--   marketplace = max($0.30, 2% × subtotal)            (was 2% in TypeScript)
--   processing  = the method's grossed-up provider cost on what the provider
--                 is ACTUALLY charged: subtotal + marketplace − promo − store
--                 credit applied                          (was on the subtotal)
--   the order total (before store credit) is topped up to $1.00 by raising the
--   marketplace fee; store credit ('wallet') pays nothing and has no minimum.
-- order_create_pending snapshots marketplace → orders.platform_fee and
-- processing → orders.payment_processing_fee / buyer_fee_amount; nothing in
-- TypeScript computes a buyer fee any more. Same 19-arg signature; the two
-- p_platform_fee* args are ignored so the old and the new build both work
-- while this deploys (db push first).
--
-- The 3-arg quote signatures are replaced by 5-arg ones with DEFAULTs: a
-- PostgREST call from the old build (three named params) still resolves.

-- ── 1. Config ────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_fee_settings
  ADD COLUMN IF NOT EXISTS buyer_marketplace_pct       numeric(5,2) NOT NULL DEFAULT 2.00
    CHECK (buyer_marketplace_pct >= 0 AND buyer_marketplace_pct <= 50),
  ADD COLUMN IF NOT EXISTS buyer_marketplace_min_minor bigint NOT NULL DEFAULT 30
    CHECK (buyer_marketplace_min_minor >= 0),
  ADD COLUMN IF NOT EXISTS buyer_min_order_total_minor bigint NOT NULL DEFAULT 100
    CHECK (buyer_min_order_total_minor >= 0);
COMMENT ON COLUMN public.platform_fee_settings.buyer_marketplace_pct IS
  'Buyer marketplace fee, % of the subtotal (keeps SafeDrop Protection running). Zero for fully store-credit orders.';
COMMENT ON COLUMN public.platform_fee_settings.buyer_marketplace_min_minor IS
  'Minimum marketplace fee, minor units of the order currency (the $0.30 floor).';
COMMENT ON COLUMN public.platform_fee_settings.buyer_min_order_total_minor IS
  'Minimum order total before store credit; the marketplace fee is raised to reach it. Not applied to store-credit orders.';

-- Store credit pays no service fee at all (owner 2026-09-29).
UPDATE public.payment_method_fees
   SET floor_pct = 0, buffer_pct = 0, min_fee_minor = 0,
       note = 'Store credit: zero service fee (owner 2026-09-29). Only fully wallet-paid orders quote this row.'
 WHERE method = 'wallet';

-- ── 2. buyer_fee_quote (5 args, defaults) ────────────────────────────────────
DROP FUNCTION IF EXISTS public.buyer_fee_quote_many(text[], bigint, text);
DROP FUNCTION IF EXISTS public.buyer_fee_quote(text, bigint, text);
CREATE OR REPLACE FUNCTION public.buyer_fee_quote(
  p_method text, p_subtotal_minor bigint, p_currency text,
  p_promo_minor bigint DEFAULT 0, p_wallet_minor bigint DEFAULT 0)
  RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r            public.payment_method_fees%ROWTYPE;
  s            public.platform_fee_settings%ROWTYPE;
  v_cur        char(3) := UPPER(COALESCE(p_currency, 'USD'))::char(3);
  v_rate_fee   numeric;   -- usd per unit of fee_currency
  v_rate_quote numeric;   -- usd per unit of the quote currency
  v_conv       numeric;   -- fee_currency minor → quote-currency minor
  v_sub        bigint := GREATEST(COALESCE(p_subtotal_minor, 0), 0);
  v_promo      bigint;
  v_wallet_req bigint := GREATEST(COALESCE(p_wallet_minor, 0), 0);
  v_mkt        bigint := 0;
  v_applied    bigint := 0;
  v_base       numeric;   -- what the provider is asked for, before its own fee
  v_fixed      numeric;
  v_denom      numeric;
  v_gross      numeric;
  v_fee        numeric;
  v_fee_minor  bigint := 0;
  v_total      bigint;
  v_charge     bigint;
  v_pct        numeric;
  v_pass       int;
  refusal      jsonb;
BEGIN
  v_promo := LEAST(GREATEST(COALESCE(p_promo_minor, 0), 0), v_sub);
  SELECT * INTO r FROM public.payment_method_fees WHERE method = p_method;
  refusal := jsonb_build_object('ok', false, 'method', p_method, 'fee_minor', NULL, 'total_minor', NULL,
                                'marketplace_minor', NULL, 'service_fee_minor', NULL, 'charge_minor', NULL,
                                'wallet_applied_minor', NULL, 'pct_effective', NULL, 'fee_currency', NULL,
                                'refundable', NULL, 'instant_clearing', NULL);
  IF NOT FOUND THEN
    RETURN refusal || jsonb_build_object('reason', 'no_fee_row');
  END IF;
  SELECT * INTO s FROM public.platform_fee_settings WHERE id;
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
  v_conv := v_rate_fee / v_rate_quote;

  -- Store credit pays nothing: no marketplace fee, no processing, no minimum.
  IF r.method = 'wallet' THEN
    v_total := GREATEST(v_sub - v_promo, 0);
    RETURN jsonb_build_object(
      'ok', true, 'reason', NULL, 'method', r.method, 'label', r.label, 'provider', r.provider,
      'marketplace_minor', 0, 'fee_minor', 0, 'service_fee_minor', 0,
      'total_minor', v_total, 'charge_minor', 0, 'wallet_applied_minor', v_total,
      'pct_effective', 0, 'fee_currency', r.fee_currency, 'refundable', r.refundable, 'instant_clearing', r.instant_clearing);
  END IF;

  -- Marketplace: max(floor, pct × subtotal), one rounding through fee_round_cents.
  v_mkt := GREATEST(s.buyer_marketplace_min_minor,
                    (public.fee_round_cents(v_sub * s.buyer_marketplace_pct / 100 / 100) * 100)::bigint);

  -- Two passes: the second only runs when the minimum-order top-up moved the base.
  FOR v_pass IN 1..2 LOOP
    -- Store credit covers the item + marketplace fee first; the provider is
    -- asked for the rest and its fee is grossed up on that remainder only.
    v_applied := LEAST(v_wallet_req, GREATEST(v_sub + v_mkt - v_promo, 0));
    v_base    := GREATEST(v_sub + v_mkt - v_promo - v_applied, 0);
    IF v_base > 0 THEN
      v_fixed := r.provider_fixed_minor * v_conv;
      v_denom := 1 - (r.provider_pct + r.fx_markup_pct + r.buffer_pct) / 100;
      v_gross := (v_base + v_fixed) / v_denom;
      v_fee   := GREATEST(r.floor_pct / 100 * v_base, v_gross - v_base);
      v_fee   := GREATEST(v_fee, r.min_fee_minor * v_conv);
      v_fee_minor := (public.fee_round_cents(v_fee / 100) * 100)::bigint;
    ELSE
      v_fee_minor := 0;
    END IF;
    v_total := v_sub + v_mkt + v_fee_minor - v_promo;
    EXIT WHEN v_pass = 2 OR v_total >= s.buyer_min_order_total_minor;
    -- Under the minimum order: raise the marketplace fee by the gap and re-quote.
    v_mkt := v_mkt + (s.buyer_min_order_total_minor - v_total);
  END LOOP;
  v_charge := v_total - v_applied;

  IF r.max_total_minor IS NOT NULL AND (v_total / v_conv) > r.max_total_minor THEN
    RETURN refusal || jsonb_build_object('reason', 'over_cap');
  END IF;
  -- B4: the provider's minimum charge (Payssion answers 417 below it, at ITS
  -- own FX rate), checked on the actual charge with 5% headroom over
  -- currency_rates. order_create_pending re-checks the same number.
  IF r.min_total_minor IS NOT NULL AND v_charge > 0 AND (v_charge / v_conv) < r.min_total_minor * 1.05 THEN
    RETURN refusal || jsonb_build_object('reason', 'under_min');
  END IF;
  v_pct := CASE WHEN v_sub > 0 THEN ROUND(v_fee_minor::numeric / v_sub * 100, 2) ELSE NULL END;
  RETURN jsonb_build_object(
    'ok', true, 'reason', NULL, 'method', r.method, 'label', r.label, 'provider', r.provider,
    'marketplace_minor', v_mkt, 'fee_minor', v_fee_minor, 'service_fee_minor', v_mkt + v_fee_minor,
    'total_minor', v_total, 'charge_minor', v_charge, 'wallet_applied_minor', v_applied,
    'pct_effective', v_pct, 'fee_currency', r.fee_currency, 'refundable', r.refundable, 'instant_clearing', r.instant_clearing);
END;
$$;
REVOKE ALL ON FUNCTION public.buyer_fee_quote(text, bigint, text, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buyer_fee_quote(text, bigint, text, bigint, bigint) TO service_role;
COMMENT ON FUNCTION public.buyer_fee_quote(text, bigint, text, bigint, bigint) IS
  'THE buyer fee quote: marketplace max(min, pct × subtotal) + method processing on (subtotal + marketplace − promo − store credit applied), total topped up to the minimum order; zero for wallet. total_minor = order total before store credit; charge_minor = what the provider is asked for. ok=false carries reason ∈ {no_fee_row, not_selectable, currency_unsupported, fx_rate_missing, over_cap, under_min}. Service-role only.';

CREATE OR REPLACE FUNCTION public.buyer_fee_quote_many(
  p_methods text[], p_subtotal_minor bigint, p_currency text,
  p_promo_minor bigint DEFAULT 0, p_wallet_minor bigint DEFAULT 0)
  RETURNS SETOF jsonb
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.buyer_fee_quote(m.method, p_subtotal_minor, p_currency, p_promo_minor, p_wallet_minor)
  FROM unnest(p_methods) WITH ORDINALITY AS m(method, ord)
  ORDER BY m.ord
$$;
REVOKE ALL ON FUNCTION public.buyer_fee_quote_many(text[], bigint, text, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buyer_fee_quote_many(text[], bigint, text, bigint, bigint) TO service_role;

-- ── 3. order_create_pending — same 19 args; both fee parts from the quote ────
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
  v_promo_minor  bigint := ROUND(COALESCE(p_promo_discount, 0) * 100)::bigint;
  v_settings     public.platform_fee_settings%ROWTYPE;
  v_quote        jsonb;
  v_mkt_minor    bigint;
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
  SELECT * INTO v_settings FROM platform_fee_settings WHERE id;

  -- 0. The buyer fee: ONE quote, from the table, for the store credit the
  --    buyer can actually apply (request clamped to the balance). Refused
  --    loudly when the method has no row / is hidden / breaches its cap.
  --    Nothing is written before this line, so a refusal leaves no trace.
  --    p_platform_fee_rate / p_platform_fee are ignored: the quote's
  --    marketplace part is the marketplace fee (buyer-service-fee, 2026-09-30).
  IF COALESCE(p_wallet_minor, 0) > 0 THEN
    v_balance := COALESCE(user_wallet_balance(p_buyer_id, v_currency), 0);
  END IF;
  v_quote := public.buyer_fee_quote(p_buyer_fee_method, v_subtotal_minor, v_currency,
                                    v_promo_minor, LEAST(COALESCE(p_wallet_minor, 0), v_balance));
  IF NOT COALESCE((v_quote->>'ok')::boolean, false) THEN
    RAISE EXCEPTION 'buyer_fee_quote: % (%)', COALESCE(v_quote->>'reason', 'refused'), COALESCE(p_buyer_fee_method, '<null>')
      USING ERRCODE = 'P0001';
  END IF;
  v_mkt_minor   := (v_quote->>'marketplace_minor')::bigint;
  v_fee_minor   := (v_quote->>'fee_minor')::bigint;
  v_fee_pct     := COALESCE((v_quote->>'pct_effective')::numeric, 0);
  v_total_minor := (v_quote->>'total_minor')::bigint;

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
        v_settings.buyer_marketplace_pct, v_fee_pct, v_mkt_minor / 100.0, v_fee_minor / 100.0,
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

  -- 3. Wallet hold (PAY-001 lock inside wallet_spend): exactly what the quote
  --    applied (already clamped to the balance and to what store credit may
  --    cover). If the balance moved between the read and the lock,
  --    wallet_spend raises and the order rolls back with it.
  IF COALESCE(p_wallet_minor, 0) > 0 THEN
    v_applied := LEAST((v_quote->>'wallet_applied_minor')::bigint, v_total_minor);
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
    'marketplace_minor', v_mkt_minor,
    'buyer_fee_minor', v_fee_minor,
    'service_fee_minor', v_mkt_minor + v_fee_minor,
    'buyer_fee_pct', v_fee_pct,
    'wallet_applied_minor', v_applied,
    'charge_minor', v_charge);
END;
$$;
REVOKE ALL ON FUNCTION public.order_create_pending(uuid, uuid, uuid, integer, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, uuid, numeric, bigint, text, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_create_pending(uuid, uuid, uuid, integer, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, uuid, numeric, bigint, text, text, timestamptz, text) TO service_role;
COMMENT ON FUNCTION public.order_create_pending(uuid, uuid, uuid, integer, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, uuid, numeric, bigint, text, text, timestamptz, text) IS
  'Checkout: order + promo usage + wallet hold + attempt in ONE transaction. Since buyer-service-fee (2026-09-30) both buyer fee parts come from buyer_fee_quote (p_platform_fee_rate / p_platform_fee are ignored): marketplace → platform_fee, processing → payment_processing_fee / buyer_fee_amount. Service-role only.';
