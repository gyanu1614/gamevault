-- Seller Application redesign ("Forest Ledger") — new columns the leaner
-- 5-step wizard needs. Every column is ADD COLUMN IF NOT EXISTS so this is
-- safe to re-run and never collides with the existing seller_applications
-- shape (all legacy columns are untouched; the server action still writes
-- the same payload it always did).
--
-- Columns:
--   games_categories  — per-game category selection from Step 1. JSONB array
--                       of { gameId, gameSlug, categorySlugs: string[] } so a
--                       seller can say "for Fortnite I sell Accounts + Items".
--                       primary_games (the flat UUID array) stays the source
--                       of truth for which games; this adds the WHAT per game.
--   selling_experience— free text from Review & Sign: prior marketplace name
--                       / store link the seller mentions. Optional.
--   payout_currency   — optional payout currency preference from Payout Setup
--                       (e.g. 'USD', 'EUR', 'USDT'). Nullable, no default.
--   seller_signature  — typed-name e-signature captured when the seller signs
--                       the Seller Agency Agreement (DocuSeal stub fallback).
--   seller_signed_at  — timestamp the signature was recorded.

ALTER TABLE public.seller_applications
  ADD COLUMN IF NOT EXISTS games_categories jsonb,
  ADD COLUMN IF NOT EXISTS selling_experience text,
  ADD COLUMN IF NOT EXISTS payout_currency text,
  ADD COLUMN IF NOT EXISTS seller_signature text,
  ADD COLUMN IF NOT EXISTS seller_signed_at timestamptz;

COMMENT ON COLUMN public.seller_applications.games_categories IS
  'Per-game category selection: [{ gameId, gameSlug, categorySlugs: string[] }]';
COMMENT ON COLUMN public.seller_applications.selling_experience IS
  'Optional: prior marketplace name / store link from Review & Sign step';
COMMENT ON COLUMN public.seller_applications.payout_currency IS
  'Optional payout currency preference (e.g. USD, EUR, USDT)';
COMMENT ON COLUMN public.seller_applications.seller_signature IS
  'Typed-name e-signature for the Seller Agency Agreement';
COMMENT ON COLUMN public.seller_applications.seller_signed_at IS
  'Timestamp the Seller Agency Agreement signature was recorded';
