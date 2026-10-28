-- ─────────────────────────────────────────────────────────────────────────────
-- Stripe card rail (2026-10-27): one payment_method_fees row, method 'stripe'
-- (hosted Checkout — Visa / Mastercard, Apple Pay, Google Pay). Standard
-- account, DropMarket is the merchant; sellers are paid from the wallet as
-- with every other method.
--
-- 1. payment_method_fees.provider accepts 'stripe'.
-- 2. The row prices Stripe's WORST case at cost (owner 2026-10-27: "make even
--    on small orders", benchmarked against Eldorado's 8% + $0.30):
--      3.15% + 20p   international (US / non-EEA) cards, stripe.com/gb/pricing
--      + 2% FX       we charge USD and Stripe pays out GBP → every payment converts
--      buffer 0      UK (1.5%) and EEA (2.5%) cards already leave room
--    buyer_fee_quote grosses that up over the total, so a card payment pays
--    its own processing on every order size and the marketplace fee (min
--    $0.30) is always kept — $1 order: card fee $0.36 vs a worst-case Stripe
--    cost of $0.36. Total buyer fees vs Eldorado: $10 $1.14 / $1.10,
--    $25 $2.17 / $2.30, $100 $7.82 / $8.30. Disputes (£20 each) are not priced in.
-- 3. selectable = false: the row ships OFF. Checkout also offers the card row
--    only while both STRIPE_* keys are set. Go-live = live keys + live webhook
--    in Vercel, then "Shown" on /admin/fees.
--
-- Insert-only (ON CONFLICT DO NOTHING): re-runnable, never touches an admin edit.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. provider check ────────────────────────────────────────────────────────
ALTER TABLE public.payment_method_fees DROP CONSTRAINT IF EXISTS payment_method_fees_provider_check;
ALTER TABLE public.payment_method_fees
  ADD CONSTRAINT payment_method_fees_provider_check
  CHECK (provider IN ('payssion', 'btcpay', 'coingate', 'stripe', 'fake', 'wallet'));

-- ── 2. the card row ──────────────────────────────────────────────────────────
INSERT INTO public.payment_method_fees
  (method, label, provider, fee_currency, provider_pct, provider_fixed_minor, fx_markup_pct, buffer_pct, floor_pct, min_fee_minor, min_total_minor, max_total_minor, refundable, instant_clearing, selectable, currencies, note) VALUES
  ('stripe', 'Credit / Debit Card', 'stripe', 'GBP', 3.15, 20, 2, 0, 5, 0, NULL, NULL, true, true, false, '{USD}',
   'Stripe UK 2026-10-27: international cards 3.15% + 20p, +2% FX (USD charge, GBP payout); worst case at cost, buffer 0. Off until live keys + webhook are set.')
ON CONFLICT (method) DO NOTHING;
