-- ─────────────────────────────────────────────────────────────────────────────
-- Checkout B3 — buyer method fees as data (docs/handoff/checkout-b3.md)
--
-- Part 1  payment_method_fees: one row per registry method (Payssion pm_ids,
--         btcpay, coingate, fake, wallet) + the EU rows from the Payssion rate
--         sheet, pre-seeded and inert until the registry carries them.
--         currency_rates: usd_per_unit for every currency a fee row prices in.
--         Both public-read (fee information, no PII, no money), writes via the
--         admin action's service-role client only, audited in fee_config_audit.
-- Part 2  buyer_fee_quote(method, subtotal_minor, currency) → jsonb: the ONLY
--         place the buyer processing fee is computed. TypeScript never does.
--         order_create_pending calls it and snapshots pct / amount / method on
--         the order (guarded columns). Fails closed on a missing row.
--
-- Formula (the provider charges its % on the TOTAL the buyer pays):
--   gross = (subtotal + fixed) / (1 − provider_pct − fx_markup_pct − buffer_pct)
--   fee   = max(floor_pct × subtotal, gross − subtotal)
--   fee   = max(fee, min_fee);  refuse when the total exceeds max_total (cap)
-- fixed / min_fee / max_total live in fee_currency and convert through
-- currency_rates into the quote currency. Rounded once, to minor units, by
-- money_round_minor (half away from zero — the rule every other amount in
-- order_create_pending already follows via ROUND(x * 100)::bigint).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Version marker ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.buyer_method_fees_version() RETURNS integer
  LANGUAGE sql IMMUTABLE AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.buyer_method_fees_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buyer_method_fees_version() TO service_role;

-- ── 1. money_round_minor — the one rounding rule for quoted money ────────────
-- No cents helper existed before this migration (order_create_pending rounds
-- inline with ROUND(x * 100)::bigint). Postgres numeric ROUND is half away
-- from zero; every input here is non-negative, so this is half-up.
CREATE OR REPLACE FUNCTION public.money_round_minor(p_amount numeric) RETURNS bigint
  LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT ROUND(p_amount, 0)::bigint $$;
REVOKE ALL ON FUNCTION public.money_round_minor(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.money_round_minor(numeric) TO service_role;
COMMENT ON FUNCTION public.money_round_minor(numeric) IS
  'Checkout B3: round a minor-unit amount to a whole minor unit, half away from zero. Used once, at the end of buyer_fee_quote.';

-- ── 2. currency_rates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.currency_rates (
  currency     char(3) PRIMARY KEY,
  usd_per_unit numeric(18,8) NOT NULL CHECK (usd_per_unit > 0),
  note         text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.currency_rates IS
  'Checkout B3: USD per unit of each currency a payment_method_fees row prices in. Converts fixed fees / minimums / caps into the quote currency. Admin-editable (/admin/fees), audited. Approximate by design — buffer_pct covers drift.';

INSERT INTO public.currency_rates (currency, usd_per_unit, note) VALUES
  ('USD', 1,          'ledger base'),
  ('EUR', 1.17,       'approx. 2026-09; edit on /admin/fees'),
  ('GBP', 1.35,       'approx. 2026-09; edit on /admin/fees'),
  ('PHP', 0.0176,     'approx. 2026-09; GCash / QR Ph / Maya fixed fees'),
  ('PLN', 0.274,      'approx. 2026-09; BLIK / P24 fixed fee'),
  ('CZK', 0.0478,     'approx. 2026-09; PayU CZ fixed fee')
ON CONFLICT (currency) DO NOTHING;

ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS currency_rates_read_all ON public.currency_rates;
CREATE POLICY currency_rates_read_all ON public.currency_rates FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policy → writes are service-role only.
REVOKE ALL ON TABLE public.currency_rates FROM anon, authenticated;
GRANT SELECT ON TABLE public.currency_rates TO anon, authenticated;

-- ── 3. payment_method_fees ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_method_fees (
  method               text PRIMARY KEY,                         -- registry key: pm_id | 'btcpay' | 'coingate' | 'fake' | 'wallet'
  label                text NOT NULL,
  provider             text NOT NULL CHECK (provider IN ('payssion','btcpay','coingate','fake','wallet')),
  fee_currency         char(3) NOT NULL DEFAULT 'USD' REFERENCES public.currency_rates(currency),
  provider_pct         numeric(6,3) NOT NULL DEFAULT 0 CHECK (provider_pct >= 0 AND provider_pct <= 50),
  provider_fixed_minor bigint NOT NULL DEFAULT 0 CHECK (provider_fixed_minor >= 0),
  fx_markup_pct        numeric(6,3) NOT NULL DEFAULT 0 CHECK (fx_markup_pct >= 0 AND fx_markup_pct <= 50),
  buffer_pct           numeric(6,3) NOT NULL DEFAULT 1 CHECK (buffer_pct >= 0 AND buffer_pct <= 20),
  floor_pct            numeric(6,3) NOT NULL DEFAULT 5 CHECK (floor_pct >= 0 AND floor_pct <= 50),
  min_fee_minor        bigint NOT NULL DEFAULT 0 CHECK (min_fee_minor >= 0),
  max_total_minor      bigint CHECK (max_total_minor IS NULL OR max_total_minor > 0),
  refundable           boolean NOT NULL DEFAULT true,
  instant_clearing     boolean NOT NULL DEFAULT true,
  selectable           boolean NOT NULL DEFAULT true,
  currencies           text[] NOT NULL DEFAULT '{USD}' CHECK (cardinality(currencies) > 0),
  note                 text,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT payment_method_fees_gross_up_finite CHECK (provider_pct + fx_markup_pct + buffer_pct < 100)
);
COMMENT ON TABLE public.payment_method_fees IS
  'Checkout B3: the buyer processing fee per payment method, as data. provider_pct / provider_fixed_minor (fee_currency) / fx_markup_pct / buffer_pct feed the gross-up; floor_pct is the minimum share of the subtotal; min_fee_minor and max_total_minor (the provider cap) are in fee_currency; selectable=false keeps the registry entry but hides the method at checkout. Quoted ONLY by buyer_fee_quote.';
COMMENT ON COLUMN public.payment_method_fees.currencies IS 'Order currencies this method may be quoted in (the ledger base is USD).';

INSERT INTO public.payment_method_fees
  (method, label, provider, fee_currency, provider_pct, provider_fixed_minor, fx_markup_pct, buffer_pct, floor_pct, min_fee_minor, max_total_minor, refundable, instant_clearing, selectable, currencies, note) VALUES
  -- Payssion, live in the registry (rate sheet 2026-09)
  ('pix_br',    'Pix',      'payssion', 'USD', 3.75, 0,    7.5, 1, 5, 35,   NULL,    true,  true,  true,  '{USD}', 'Sheet: 3.75% min $0.35; FX Brazil 7.5%'),
  ('gcash_ph',  'GCash',    'payssion', 'PHP', 5,    1000, 3.4, 1, 5, 0,    NULL,    true,  true,  true,  '{USD}', 'Sheet: 5% + 10 PHP; FX Philippines 3.4%'),
  ('qr_ph',     'QR Ph',    'payssion', 'PHP', 2.5,  1500, 3.4, 1, 5, 0,    NULL,    false, true,  true,  '{USD}', 'Sheet: 2.5% + 15 PHP; no refunds provider-side'),
  ('maya_ph',   'Maya',     'payssion', 'PHP', 3.5,  0,    3.4, 1, 5, 0,    1000000, false, true,  false, '{USD}', 'Sheet: 3.5%, cap 10,000 PHP, no refunds; hidden (owner decision)'),
  ('qris_id',   'QRIS',     'payssion', 'USD', 2.5,  0,    0,   1, 5, 0,    NULL,    true,  true,  true,  '{USD}', 'Sheet: 2.5%; FX not yet measured'),
  ('spei_mx',   'SPEI',     'payssion', 'USD', 4.25, 0,    4.8, 1, 5, 0,    NULL,    true,  true,  true,  '{USD}', 'Sheet: 4.25%; FX Mexico 4.8%'),
  ('oxxo_mx',   'OXXO',     'payssion', 'USD', 4.25, 0,    4.8, 1, 5, 0,    NULL,    true,  false, false, '{USD}', 'Sheet: 4.25%; FX Mexico 4.8%; voucher; hidden (owner decision)'),
  ('boleto_br', 'Boleto',   'payssion', 'USD', 4.25, 0,    7.5, 1, 5, 0,    NULL,    true,  false, false, '{USD}', 'NOT on the 2026-09 sheet — placeholder rate; voucher; hidden (owner decision)'),
  ('pse_co',    'PSE',      'payssion', 'USD', 4.25, 0,    0,   1, 5, 0,    NULL,    true,  true,  true,  '{USD}', 'Sheet: 4.25%; FX not yet measured'),
  ('webpay_cl', 'WebPay',   'payssion', 'USD', 4.25, 0,    0,   1, 5, 0,    NULL,    true,  true,  true,  '{USD}', 'Sheet: 4.25%; FX not yet measured'),
  ('payssion_test', 'Payssion Test', 'payssion', 'USD', 0, 0, 0, 1, 5, 0,   NULL,    true,  true,  true,  '{USD,EUR,GBP}', 'Sandbox simulator; only routes under PAYSSION_TESTMODE'),
  -- Payssion EU (rate sheet 2026-09) — inert until the registry carries the pm_id (probe first: 491 = not enabled)
  ('trustly',     'Trustly',       'payssion', 'EUR', 2.5,  35,  0, 1, 5, 0,   NULL,  true,  true, true, '{USD,EUR,GBP}', 'Sheet: 2.5% + €0.35; pm_id to confirm by probe'),
  ('blik_pl',     'BLIK',          'payssion', 'PLN', 4.75, 55,  0, 1, 5, 0,   NULL,  true,  true, true, '{USD,EUR,GBP}', 'Sheet: 4.75% + 0.55 zł; pm_id to confirm by probe'),
  ('p24_pl',      'Przelewy24',    'payssion', 'PLN', 4.75, 55,  0, 1, 5, 0,   NULL,  true,  true, true, '{USD,EUR,GBP}', 'Sheet: 4.75% + 0.55 zł; pm_id to confirm by probe'),
  ('eps_at',      'EPS',           'payssion', 'EUR', 3.75, 45,  0, 1, 5, 100, NULL,  true,  true, true, '{USD,EUR,GBP}', 'Sheet: 3.75% + €0.45, €1 min; pm_id to confirm by probe'),
  ('mbway_pt',    'MB Way',        'payssion', 'EUR', 2.75, 25,  0, 1, 5, 100, NULL,  true,  true, true, '{USD,EUR,GBP}', 'Sheet: 2.75% + €0.25, €1 min; pm_id to confirm by probe'),
  ('bancomat_it', 'BANCOMAT Pay',  'payssion', 'EUR', 2.75, 20,  0, 1, 5, 0,   NULL,  true,  true, true, '{USD,EUR,GBP}', 'Sheet: 2.75% + €0.20; pm_id to confirm by probe'),
  ('payu_cz',     'PayU',          'payssion', 'CZK', 4.75, 350, 0, 1, 5, 0,   NULL,  true,  true, true, '{USD,EUR,GBP}', 'Sheet: 4.75% + 3.5 Kč; pm_id to confirm by probe'),
  ('paysafecard', 'paysafecard',   'payssion', 'EUR', 12.5, 0,   0, 1, 5, 0,   25000, false, true, true, '{USD,EUR,GBP}', 'Sheet: 12.5%, cap €250, no refunds; registry entry commented out until the 491 clears'),
  -- Crypto + wallet: today''s buyer fee (the 5% floor), now as rows
  ('btcpay',   'Crypto (BTCPay)',   'btcpay',   'USD', 0, 0, 0, 1, 5, 0, NULL, true, true, true, '{USD,EUR,GBP}', 'Self-hosted; no provider %. Floor 5% = today''s processing fee'),
  ('coingate', 'Crypto (CoinGate)', 'coingate', 'USD', 1, 0, 0, 1, 5, 0, NULL, true, true, true, '{USD,EUR,GBP}', 'CoinGate 1% — under the 5% floor. Floor = today''s processing fee'),
  ('wallet',   'Store credit',      'wallet',   'USD', 0, 0, 0, 1, 5, 0, NULL, true, true, true, '{USD,EUR,GBP}', 'Fully wallet-paid orders. Floor 5% = today''s processing fee'),
  ('fake',     'Test provider',     'fake',     'USD', 0, 0, 0, 1, 5, 0, NULL, true, true, true, '{USD,EUR,GBP}', 'Tests only — reachable solely when PAYMENT_PROVIDER=fake')
ON CONFLICT (method) DO NOTHING;

ALTER TABLE public.payment_method_fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_method_fees_read_all ON public.payment_method_fees;
CREATE POLICY payment_method_fees_read_all ON public.payment_method_fees FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policy → writes are service-role only (admin action + audit row).
REVOKE ALL ON TABLE public.payment_method_fees FROM anon, authenticated;
GRANT SELECT ON TABLE public.payment_method_fees TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.payment_method_fees_touch() RETURNS trigger
  LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.payment_method_fees_touch() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_payment_method_fees_touch ON public.payment_method_fees;
CREATE TRIGGER trg_payment_method_fees_touch BEFORE UPDATE ON public.payment_method_fees
  FOR EACH ROW EXECUTE FUNCTION public.payment_method_fees_touch();
DROP TRIGGER IF EXISTS trg_currency_rates_touch ON public.currency_rates;
CREATE TRIGGER trg_currency_rates_touch BEFORE UPDATE ON public.currency_rates
  FOR EACH ROW EXECUTE FUNCTION public.payment_method_fees_touch();

-- ── 4. buyer_fee_quote ───────────────────────────────────────────────────────
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
  v_fee_minor   := public.money_round_minor(v_fee);
  v_total_minor := p_subtotal_minor + v_fee_minor;
  IF r.max_total_minor IS NOT NULL AND (v_total_minor / v_conv) > r.max_total_minor THEN
    RETURN refusal || jsonb_build_object('reason', 'over_cap');
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
  'Checkout B3: THE buyer processing-fee quote. ok=false carries reason ∈ {no_fee_row, not_selectable, currency_unsupported, fx_rate_missing, over_cap}. Service-role only; the page and createCheckout reach it through eligibleMethods.';

CREATE OR REPLACE FUNCTION public.buyer_fee_quote_many(p_methods text[], p_subtotal_minor bigint, p_currency text)
  RETURNS SETOF jsonb
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.buyer_fee_quote(m.method, p_subtotal_minor, p_currency)
  FROM unnest(p_methods) WITH ORDINALITY AS m(method, ord)
  ORDER BY m.ord
$$;
REVOKE ALL ON FUNCTION public.buyer_fee_quote_many(text[], bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buyer_fee_quote_many(text[], bigint, text) TO service_role;

-- ── 5. orders — the buyer-fee snapshot (guarded columns) ─────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_fee_pct    numeric(6,2),
  ADD COLUMN IF NOT EXISTS buyer_fee_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS buyer_fee_method text;
COMMENT ON COLUMN public.orders.buyer_fee_pct IS
  'Checkout B3: effective buyer processing-fee % (fee ÷ subtotal) quoted by buyer_fee_quote at creation. NULL = order predates B3. Guarded.';
COMMENT ON COLUMN public.orders.buyer_fee_amount IS
  'Checkout B3: the buyer processing fee charged on THIS order (major units), from buyer_fee_quote. Mirrored into payment_processing_fee. Guarded.';
COMMENT ON COLUMN public.orders.buyer_fee_method IS
  'Checkout B3: the payment_method_fees.method the fee was quoted for (pm_id, btcpay, coingate, wallet). Guarded.';

-- Re-created IN FULL (every existing check verbatim from 20260921201609) with
-- the three new columns appended: a buyer must not rewrite their own quoted
-- fee through PostgREST and dispute the total against it.
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
  -- ── checkout B3 ──
  IF NEW.buyer_fee_pct IS DISTINCT FROM OLD.buyer_fee_pct THEN changed := array_append(changed, 'buyer_fee_pct'); END IF;
  IF NEW.buyer_fee_amount IS DISTINCT FROM OLD.buyer_fee_amount THEN changed := array_append(changed, 'buyer_fee_amount'); END IF;
  IF NEW.buyer_fee_method IS DISTINCT FROM OLD.buyer_fee_method THEN changed := array_append(changed, 'buyer_fee_method'); END IF;
  IF array_length(changed, 1) > 0 THEN
    RAISE EXCEPTION 'orders: column(s) % are protected and cannot be changed by this caller',
      array_to_string(changed, ', ')
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 6. order_create_pending — the quote happens INSIDE the money transaction ──
-- Signature change: p_payment_processing_fee_rate, p_payment_processing_fee
-- and p_total_amount are gone (TypeScript no longer computes the fee or the
-- total); p_buyer_fee_method arrives. Old code against the new DB fails closed
-- (no matching overload → PGRST202); deploy code and push together.
DROP FUNCTION IF EXISTS public.order_create_pending(uuid, uuid, uuid, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, uuid, numeric, bigint, text, text, timestamptz);

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
COMMENT ON FUNCTION public.order_create_pending(uuid, uuid, uuid, integer, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, text, uuid, numeric, bigint, text, text, timestamptz, text) IS
  'Round B Part 1 + Checkout B3: buyer_fee_quote(p_buyer_fee_method) → pending order (fee + total computed HERE, snapshotted on buyer_fee_pct/amount/method and mirrored into payment_processing_fee*) + promo usage + wallet hold (checkout_wallet:<id>) + created payment attempt, ONE transaction. Re-raises unique violations with the constraint name; retries an order_number collision once. Service-role only.';
