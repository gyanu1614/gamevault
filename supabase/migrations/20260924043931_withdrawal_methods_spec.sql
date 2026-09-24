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
