-- ============================================================================
-- Post-deploy fix 1 — withdrawal_methods: the intended row for every method,
-- by method_name, whatever the environment already had.
--
-- Why: PR 7 (20260923031644) inserted Payoneer only IF NOT EXISTS. Production
-- already carried payoneer / paypal / bank rows from before the baseline, so
-- the insert was skipped and Payoneer went live with that old row's fees
-- (fixed by hand on 2026-09-23). Local stacks never had those rows, so local
-- and prod disagreed and no test could see it.
--
-- The fee-engine spec (PR 7; /fees "Withdrawals"; withdrawal-methods-spec
-- guard):
--   · USDT TRC-20 / ERC-20 / Polygon — 3% + $5, no minimum fee, $50–$25,000, live.
--   · Payoneer — 3%, $0 fixed, $5 minimum fee, $100–$25,000, live.
--   · Any other fiat row (PayPal, bank) — is_active = false, coming_soon = true;
--     nothing else about it is touched.
--   · Any other crypto row (pre-baseline BTC / ETH / USDC on prod) — the shared
--     crypto fee terms only; its visibility is left as it is.
--
-- Idempotent: a row that already matches is not written and gets no audit row;
-- every change writes one fee_config_audit row (actor NULL, like PR 7's seed).
--
-- Also (section 4): withdrawal_methods_set_fees takes p_coming_soon so
-- /admin/fees can switch "coming soon" through the same audited RPC.
-- ============================================================================

DO $$
DECLARE
  s RECORD;
  r RECORD;
  v_spec jsonb;
  v_before jsonb;
  v_old jsonb;
BEGIN
  -- ── 1. The spec rows: UPSERT by method_name ──────────────────────────────
  FOR s IN
    SELECT * FROM (VALUES
      ('payoneer',     'Payoneer',      'fiat',   NULL,   NULL,       3.00, 0.00, 5.00, 'USD', 100.00, 25000.00, '1–3 business days after approval', true, false, 'payoneer', 'Paid to the Payoneer account saved in your payout settings.', false,  5),
      ('usdt_trc20',   'USDT (TRC-20)', 'crypto', 'usdt', 'tron',     3.00, 5.00, 0.00, 'USD',  50.00, 25000.00, '1-2 business days',                true, false, 'Coins',    'Lowest network fees. Send only over the Tron network.',       false, 10),
      ('usdt_erc20',   'USDT (ERC-20)', 'crypto', 'usdt', 'ethereum', 3.00, 5.00, 0.00, 'USD',  50.00, 25000.00, '1-2 business days',                true, false, 'Coins',    'Send only over the Ethereum network.',                        false, 20),
      ('usdt_polygon', 'USDT (Polygon)', 'crypto', 'usdt', 'polygon', 3.00, 5.00, 0.00, 'USD',  50.00, 25000.00, '1-2 business days',                true, false, 'Coins',    'Low fees. Send only over the Polygon network.',               false, 30)
    ) AS t(method_name, display_name, method_type, coin, chain, fee_percentage, fee_fixed, fee_min, fee_currency,
           min_withdrawal, max_withdrawal, processing_time, is_active, requires_kyc, icon_name, description, coming_soon, sort_order)
  LOOP
    v_spec := to_jsonb(s);
    SELECT to_jsonb(w) INTO v_before FROM public.withdrawal_methods w WHERE w.method_name = s.method_name;
    v_old := (SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(v_before) e WHERE v_spec ? e.key);
    CONTINUE WHEN v_old IS NOT DISTINCT FROM v_spec;

    INSERT INTO public.withdrawal_methods
      (method_name, display_name, method_type, coin, chain, fee_percentage, fee_fixed, fee_min, fee_currency,
       min_withdrawal, max_withdrawal, processing_time, is_active, requires_kyc, icon_name, description, coming_soon, sort_order)
    VALUES
      (s.method_name, s.display_name, s.method_type, s.coin, s.chain, s.fee_percentage, s.fee_fixed, s.fee_min, s.fee_currency,
       s.min_withdrawal, s.max_withdrawal, s.processing_time, s.is_active, s.requires_kyc, s.icon_name, s.description, s.coming_soon, s.sort_order)
    ON CONFLICT (method_name) DO UPDATE SET
      display_name = excluded.display_name, method_type = excluded.method_type, coin = excluded.coin, chain = excluded.chain,
      fee_percentage = excluded.fee_percentage, fee_fixed = excluded.fee_fixed, fee_min = excluded.fee_min, fee_currency = excluded.fee_currency,
      min_withdrawal = excluded.min_withdrawal, max_withdrawal = excluded.max_withdrawal, processing_time = excluded.processing_time,
      is_active = excluded.is_active, requires_kyc = excluded.requires_kyc, icon_name = excluded.icon_name,
      description = excluded.description, coming_soon = excluded.coming_soon, sort_order = excluded.sort_order, updated_at = now();

    INSERT INTO public.fee_config_audit (actor, scope, key, old_value, new_value)
    VALUES (NULL, 'withdrawal_method', s.method_name, v_old, v_spec || jsonb_build_object('note', 'post-deploy-1: withdrawal_methods spec'));
  END LOOP;

  -- ── 2. Every other fiat rail stays hidden behind "coming soon" ───────────
  FOR r IN
    SELECT * FROM public.withdrawal_methods
     WHERE method_type = 'fiat' AND method_name <> 'payoneer'
       AND (is_active IS DISTINCT FROM false OR coming_soon IS DISTINCT FROM true)
  LOOP
    UPDATE public.withdrawal_methods SET is_active = false, coming_soon = true, updated_at = now() WHERE id = r.id;
    INSERT INTO public.fee_config_audit (actor, scope, key, old_value, new_value)
    VALUES (NULL, 'withdrawal_method', r.method_name,
      jsonb_build_object('is_active', r.is_active, 'coming_soon', r.coming_soon),
      jsonb_build_object('is_active', false, 'coming_soon', true, 'note', 'post-deploy-1: fiat rail stays coming soon'));
  END LOOP;

  -- ── 3. Any other crypto row shares the crypto fee terms ──────────────────
  FOR r IN
    SELECT * FROM public.withdrawal_methods
     WHERE method_type = 'crypto' AND method_name NOT IN ('usdt_trc20', 'usdt_erc20', 'usdt_polygon')
       AND (fee_percentage IS DISTINCT FROM 3.00 OR fee_fixed IS DISTINCT FROM 5.00 OR fee_min IS DISTINCT FROM 0 OR min_withdrawal IS DISTINCT FROM 50.00)
  LOOP
    UPDATE public.withdrawal_methods
       SET fee_percentage = 3.00, fee_fixed = 5.00, fee_min = 0, min_withdrawal = 50.00, updated_at = now()
     WHERE id = r.id;
    INSERT INTO public.fee_config_audit (actor, scope, key, old_value, new_value)
    VALUES (NULL, 'withdrawal_method', r.method_name,
      jsonb_build_object('fee_percentage', r.fee_percentage, 'fee_fixed', r.fee_fixed, 'fee_min', r.fee_min, 'min_withdrawal', r.min_withdrawal),
      jsonb_build_object('fee_percentage', 3.00, 'fee_fixed', 5.00, 'fee_min', 0, 'min_withdrawal', 50.00, 'note', 'post-deploy-1: crypto 3% + $5, min $50'));
  END LOOP;
END $$;

-- ── 4. /admin/fees: coming_soon becomes an audited admin switch ────────────
-- withdrawal_methods_set_fees gains p_coming_soon (NULL = leave as is), and
-- its fee_config_audit row carries coming_soon next to is_active. The
-- argument list changes, so the 8-argument version is dropped first (two
-- overloads with a default would make an 8-argument call ambiguous).
DROP FUNCTION IF EXISTS public.withdrawal_methods_set_fees(uuid, uuid, numeric, numeric, numeric, numeric, numeric, boolean);
CREATE OR REPLACE FUNCTION public.withdrawal_methods_set_fees(
  p_method_id uuid, p_admin_id uuid, p_fee_pct numeric, p_fee_fixed numeric, p_fee_min numeric, p_min numeric, p_max numeric,
  p_is_active boolean, p_coming_soon boolean DEFAULT NULL
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
         min_withdrawal = fee_round_cents(p_min), max_withdrawal = fee_round_cents(p_max), is_active = p_is_active,
         coming_soon = COALESCE(p_coming_soon, coming_soon), updated_at = now()
   WHERE id = p_method_id RETURNING * INTO v_new;
  INSERT INTO fee_config_audit (actor, scope, key, old_value, new_value)
  VALUES (p_admin_id, 'withdrawal_method', v_old.method_name,
    jsonb_build_object('fee_percentage', v_old.fee_percentage, 'fee_fixed', v_old.fee_fixed, 'fee_min', v_old.fee_min, 'min_withdrawal', v_old.min_withdrawal, 'max_withdrawal', v_old.max_withdrawal, 'is_active', v_old.is_active, 'coming_soon', v_old.coming_soon),
    jsonb_build_object('fee_percentage', v_new.fee_percentage, 'fee_fixed', v_new.fee_fixed, 'fee_min', v_new.fee_min, 'min_withdrawal', v_new.min_withdrawal, 'max_withdrawal', v_new.max_withdrawal, 'is_active', v_new.is_active, 'coming_soon', v_new.coming_soon));
  RETURN to_jsonb(v_new);
END;
$$;
REVOKE ALL ON FUNCTION public.withdrawal_methods_set_fees(uuid, uuid, numeric, numeric, numeric, numeric, numeric, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_methods_set_fees(uuid, uuid, numeric, numeric, numeric, numeric, numeric, boolean, boolean) TO service_role;
