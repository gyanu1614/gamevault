-- ─────────────────────────────────────────────────────────────────────────────
-- Payssion card + Apple Pay labels follow the checkout (owner 2026-10-22).
--
-- PR #227 (9b29129a) renamed five rails in the code registry
-- (lib/payments/providers/payssion/methods.ts) but shipped no migration, so
-- their payment_method_fees rows kept the country names that
-- 20261015170458_payssion_17_methods seeded. The DB label is what buyers read
-- on /fees and on the wallet's "Refund To Card" line ("To <label> $X");
-- the checkout reads the registry. global-payment-methods.guard pins the two
-- equal.
--
-- Label only: no fee, cap, refundability or selectable flag changes. Each row
-- is matched on its old label too, so a row that already says something else
-- is left alone. updated_at is set by trg_payment_method_fees_touch.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.payment_method_fees f
   SET label = v.new_label
  FROM (VALUES
    ('creditcard_br', 'Brazilian Cards',          'Credit / Debit Card'),
    ('creditcard_mx', 'Mexican Cards',            'Credit / Debit Card'),
    ('creditcard_za', 'South African Cards',      'Credit / Debit Card'),
    ('mada_sa',       'Saudi Cards (mada)',       'Credit / Debit Card'),
    ('applepay_sa',   'Apple Pay (Saudi Arabia)', 'Apple Pay')
  ) AS v(method, old_label, new_label)
 WHERE f.method = v.method
   AND f.label = v.old_label;
