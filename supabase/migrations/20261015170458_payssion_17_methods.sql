-- ─────────────────────────────────────────────────────────────────────────────
-- Payssion: 17 methods enabled 2026-10-15 (probe: USD 2.00 each → 200, every
-- transaction cancelled; docs/payments/eu-methods-probe.md, docs/checkout.md §7)
--
-- Rows ONLY — no function, grant or policy changes. buyer_fee_quote prices
-- these exactly like every other method. Insert-only (ON CONFLICT DO NOTHING):
-- re-runnable, and it never touches an existing row or an admin edit.
--
-- 1. currency_rates for the new fee currencies (approx. market 2026-10-15,
--    open.er-api.com; editable on /admin/fees like the rest).
--    KRW and VND have no minor unit. buyer_fee_quote converts minor units by
--    the rate alone (it assumes 2 dp), so their *_minor amounts below are
--    stored ×100 like every other currency: 200 KRW = 20000.
-- 2. payment_method_fees: what Payssion charges us (rate sheet 2025-12-11):
--    provider %, fixed fee, minimum (min_total_minor) and maximum
--    (max_total_minor) charge in the fee currency, refunds. No FX markup
--    (owner 2026-10-15); buffer 1% and floor 5% as on every Payssion row.
--    Skrill: the sheet's fee is 3.5% + $0.35 but its limits are €1–€2,000;
--    a row has one currency, so it is EUR with the $0.35 as €0.30 (EUR 1.17).
--    creditcard_br: the sheet's 1 BRL minimum is below our $1.00 order
--    minimum, so no min_total; the cap is $500.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. currency_rates ────────────────────────────────────────────────────────
INSERT INTO public.currency_rates (currency, usd_per_unit, note) VALUES
  ('KRW', 0.000746,  'approx. 2026-10; Kakao Pay limits (KRW amounts stored ×100)'),
  ('SGD', 0.7794,    'approx. 2026-10; PayNow / GrabPay limits'),
  ('MYR', 0.2450,    'approx. 2026-10; FPX fixed fee / TNG eWallet limits'),
  ('VND', 0.0000386, 'approx. 2026-10; VietQR limits (VND amounts stored ×100)'),
  ('SAR', 0.2667,    'pegged 3.75 per USD; mada / Apple Pay (SA) limits'),
  ('ZAR', 0.0603,    'approx. 2026-10; South African Cards limits'),
  ('MXN', 0.0542,    'approx. 2026-10; Mexican Cards limits'),
  ('PEN', 0.2907,    'approx. 2026-10; BCP limits'),
  ('CHF', 1.1996,    'approx. 2026-10; TWINT fixed fee / limits')
ON CONFLICT (currency) DO NOTHING;

-- ── 2. payment_method_fees ───────────────────────────────────────────────────
INSERT INTO public.payment_method_fees
  (method, label, provider, fee_currency, provider_pct, provider_fixed_minor, fx_markup_pct, buffer_pct, floor_pct, min_fee_minor, min_total_minor, max_total_minor, refundable, instant_clearing, selectable, currencies, note) VALUES
  -- Worldwide
  ('skrill',        'Skrill',                   'payssion', 'EUR', 3.5,  30,  0, 1, 5, 0, 100,    200000,     true,  true,  true, '{USD,EUR,GBP}', 'Sheet: 3.5% + $0.35 (stored €0.30), €1–€2,000; pm_id probe 200 2026-10-15'),
  -- Latin America
  ('creditcard_br', 'Brazilian Cards',          'payssion', 'USD', 4.25, 0,   0, 1, 5, 0, NULL,   50000,      true,  true,  true, '{USD}', 'Sheet: 4.25%, max $500 (1 BRL min is under our $1 order minimum); pm_id probe 200 2026-10-15'),
  ('creditcard_mx', 'Mexican Cards',            'payssion', 'MXN', 4.25, 0,   0, 1, 5, 0, 100,    1000000,    true,  true,  true, '{USD}', 'Sheet: 4.25%, 1–10,000 MXN; pm_id probe 200 2026-10-15'),
  ('bcp_pe',        'BCP',                      'payssion', 'PEN', 4.25, 0,   0, 1, 5, 0, 500,    750000,     true,  false, true, '{USD}', 'Sheet: 4.25%, 5–7,500 PEN; pay-by-reference (48h window); pm_id probe 200 2026-10-15'),
  -- Southeast Asia
  ('fpx_my',        'FPX',                      'payssion', 'MYR', 3.5,  180, 0, 1, 5, 0, 200,    500000,     true,  true,  true, '{USD}', 'Sheet: 3.5% + 1.80 MYR, 2 MYR (corporate-banking minimum)–5,000 MYR; pm_id probe 200 2026-10-15'),
  ('touchngo_my',   'TNG eWallet',              'payssion', 'MYR', 3.5,  0,   0, 1, 5, 0, 100,    150000,     false, true,  true, '{USD}', 'Sheet: 3.5%, 1–1,500 MYR, no provider refunds; pm_id probe 200 2026-10-15'),
  ('paynow_sg',     'PayNow',                   'payssion', 'SGD', 3,    0,   0, 1, 5, 0, 1,      100000,     true,  true,  true, '{USD}', 'Sheet: 3%, 0.01–1,000 SGD; pm_id probe 200 2026-10-15'),
  ('grabpay_sg',    'GrabPay',                  'payssion', 'SGD', 3,    0,   0, 1, 5, 0, 1,      100000,     true,  true,  true, '{USD}', 'Sheet: 3%, 0.01–1,000 SGD; pm_id probe 200 2026-10-15'),
  ('vietqr_vn',     'VietQR',                   'payssion', 'VND', 5,    0,   0, 1, 5, 0, 200000, 5000000000, true,  true,  true, '{USD}', 'Sheet: 5%, 2,000–50,000,000 VND (stored ×100); pm_id probe 200 2026-10-15'),
  -- Europe
  ('bancontact_be', 'Bancontact',               'payssion', 'EUR', 4.25, 45,  0, 1, 5, 0, 100,    200000,     true,  true,  true, '{USD,EUR,GBP}', 'Sheet: 4.25% + €0.45, €1–€2,000; pm_id probe 200 2026-10-15'),
  ('satispay',      'Satispay',                 'payssion', 'EUR', 3.75, 35,  0, 1, 5, 0, NULL,   200000,     true,  true,  true, '{USD,EUR,GBP}', 'Sheet: 3.75% + €0.35, max €2,000; pm_id probe 200 2026-10-15'),
  ('mybank',        'MyBank',                   'payssion', 'EUR', 2.25, 35,  0, 1, 5, 0, NULL,   200000,     true,  true,  true, '{USD,EUR,GBP}', 'Sheet: 2.25% + €0.35, max €2,000; pm_id probe 200 2026-10-15'),
  ('twint_ch',      'TWINT',                    'payssion', 'CHF', 3.5,  15,  0, 1, 5, 0, 10,     500000,     true,  true,  true, '{USD,EUR,GBP}', 'Sheet: 3.5% + 0.15 CHF, 0.10–5,000 CHF; pm_id probe 200 2026-10-15'),
  -- Middle East & Africa
  ('mada_sa',       'Saudi Cards (mada)',       'payssion', 'SAR', 5.5,  0,   0, 1, 5, 0, 10,     200000,     true,  true,  true, '{USD}', 'Sheet: 5.5%, 0.10–2,000 SAR, refunds within 30 days; pm_id probe 200 2026-10-15'),
  ('applepay_sa',   'Apple Pay (Saudi Arabia)', 'payssion', 'SAR', 5.5,  0,   0, 1, 5, 0, 10,     200000,     true,  true,  true, '{USD}', 'Sheet: 5.5%, 0.10–2,000 SAR, refunds within 30 days; pm_id probe 200 2026-10-15'),
  ('creditcard_za', 'South African Cards',      'payssion', 'ZAR', 4.5,  0,   0, 1, 5, 0, 100,    1000000,    true,  true,  true, '{USD}', 'Sheet: 4.5%, 1–10,000 ZAR; pm_id probe 200 2026-10-15'),
  -- East Asia
  ('kakaopay_kr',   'Kakao Pay',                'payssion', 'KRW', 3.9,  0,   0, 1, 5, 0, 20000,  100000000,  true,  true,  true, '{USD}', 'Sheet: 3.9%, 200–1,000,000 KRW (stored ×100); pm_id probe 200 2026-10-15')
ON CONFLICT (method) DO NOTHING;
