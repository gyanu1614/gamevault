-- ============================================================
-- MONEY LAYER — Phase 6a, part 1/2: add wallet ledger account kinds
-- Created: 2026-06-29
--
-- MUST run BEFORE part 2 (20260629_wallet_ledger_cutover_2.sql), as its own
-- statement batch. PostgreSQL forbids using a newly-added enum value in the
-- SAME transaction it was added ("unsafe use of new enum value"), so the
-- genesis/RPC code that REFERENCES these kinds lives in part 2.
--
--   user_wallet      — buyer spendable funds (top-ups, cashback, refunds-in).
--                      Distinct from seller_available (seller earnings).
--   genesis_clearing — counterparty for opening-balance imports at cutover.
--
-- Idempotent.
-- ============================================================

ALTER TYPE ledger_account_kind ADD VALUE IF NOT EXISTS 'user_wallet';
ALTER TYPE ledger_account_kind ADD VALUE IF NOT EXISTS 'genesis_clearing';
