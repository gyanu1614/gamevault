-- Shorten seller onboarding: make the Personal Info fields optional so the
-- application can submit without that step.
--
-- Compliance: identity is still verified by Didit KYC at signup (legal name,
-- document, liveness). The legal/payout details (full legal name confirmation,
-- country, tax residency) are collected LATER — before the first payout, at the
-- Wallet withdrawal gate. So these columns become nullable here; the withdrawal
-- flow is what enforces they're present before money moves. `display_name`
-- stays required (it's the store name, collected on step 1) and its ≥3-char
-- CHECK is unaffected.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS + guarded ALTERs.

-- 1. Make the deferred fields nullable.
ALTER TABLE public.seller_applications ALTER COLUMN full_legal_name DROP NOT NULL;
ALTER TABLE public.seller_applications ALTER COLUMN country          DROP NOT NULL;
ALTER TABLE public.seller_applications ALTER COLUMN phone_number     DROP NOT NULL;

-- 2. Drop the phone-length CHECK — an empty/absent phone must not fail submit.
--    (valid_display_name stays: display_name is still collected on step 1.)
ALTER TABLE public.seller_applications DROP CONSTRAINT IF EXISTS valid_phone;
