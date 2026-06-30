-- ============================================================
-- MONEY LAYER — Phase 1: Double-entry ledger (source of truth)
-- Created: 2026-06-28
--
-- The ledger is the single source of truth for money. Every money event
-- (buyer pays, escrow releases, refund, payout, reserve hold/release) is a
-- BALANCED journal: a set of >=2 entries whose debits equal credits, per
-- currency, written atomically. Balances are DERIVED by summing entries —
-- never stored as a mutable number anyone can overwrite.
--
-- Money is integer MINOR UNITS (cents) in BIGINT. No floats, ever.
--
-- Design notes:
--   * The ONLY write path is the post_journal() RPC. It validates balance,
--     resolves/creates accounts, and is idempotent on idempotency_key.
--   * ledger_entries is APPEND-ONLY — a trigger blocks UPDATE/DELETE so
--     history can never be rewritten (corrections = new compensating entries).
--   * These tables are service-role-only: RLS is enabled with NO policy for
--     `authenticated`, so PostgREST/anon/auth'd clients get zero rows. All
--     access goes through post_journal() (SECURITY DEFINER) called from the
--     service-role client. (This is the lesson from the auth audit: never a
--     USING(true) policy on a money table.)
--
-- Idempotent: safe to re-run. Uses IF NOT EXISTS / CREATE OR REPLACE / guarded
-- DO blocks throughout.
-- ============================================================

-- ─── Enums ────────────────────────────────────────────────────────

-- Internal account kinds (each is per-currency, per-owner).
DO $$ BEGIN
  CREATE TYPE ledger_account_kind AS ENUM (
    'buyer_clearing',      -- transient: buyer's inbound payment landing
    'escrow_held',         -- funds held under SafeDrop, not yet the seller's
    'seller_available',    -- released to seller, withdrawable (subject to reserve)
    'seller_reserve',      -- held back against chargebacks (dormant for crypto)
    'platform_commission', -- our fee income
    'provider_float',      -- money physically at the provider (CoinGate/Tazapay)
    'payout_clearing',     -- outbound to seller, in flight
    'refunds',             -- refunds out
    'fx_gain_loss',        -- settlement FX differences (spec hardening §D)
    'rounding'             -- minor-unit rounding differences (spec hardening §D)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ledger_owner_type AS ENUM ('platform', 'seller', 'buyer', 'provider', 'external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ledger_direction AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Tables ───────────────────────────────────────────────────────

-- Internal accounts. One row per (owner_type, owner_id, kind, currency).
-- owner_id is NULL for platform/provider singletons (e.g. platform_commission).
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type  ledger_owner_type   NOT NULL,
  owner_id    UUID,                                 -- user id for seller/buyer; NULL for platform/provider
  kind        ledger_account_kind NOT NULL,
  currency    CHAR(3)             NOT NULL,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Uniqueness with a NULL-safe key (owner_id NULL must still be unique per kind+currency).
CREATE UNIQUE INDEX IF NOT EXISTS ledger_accounts_identity_idx
  ON public.ledger_accounts (owner_type, COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, currency);

-- Transactions group a balanced set of entries. idempotency_key dedupes replays.
CREATE TABLE IF NOT EXISTS public.ledger_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,             -- e.g. "coingate:chargeId:paid"
  event_ref       TEXT,                             -- canonical event / action that caused it (free-text)
  order_id        UUID,                             -- optional link to orders(id)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only double-entry lines. Each row debits or credits one account.
-- INVARIANT (enforced by post_journal): per transaction, per currency,
-- sum(debits) == sum(credits).
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  account_id     UUID NOT NULL REFERENCES public.ledger_accounts(id)     ON DELETE RESTRICT,
  direction      ledger_direction NOT NULL,
  amount_minor   BIGINT NOT NULL CHECK (amount_minor > 0),  -- always positive; direction carries sign
  currency       CHAR(3) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ledger_entries_txn_idx     ON public.ledger_entries (transaction_id);
CREATE INDEX IF NOT EXISTS ledger_entries_account_idx ON public.ledger_entries (account_id, currency);

-- ─── Append-only enforcement ──────────────────────────────────────
-- Money history is immutable. Corrections are NEW compensating entries,
-- never edits/deletes. Block UPDATE and DELETE on entries + transactions.

CREATE OR REPLACE FUNCTION ledger_block_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ledger is append-only: % on % is not permitted (post a compensating entry instead)',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_entries_immutable ON public.ledger_entries;
CREATE TRIGGER trg_ledger_entries_immutable
  BEFORE UPDATE OR DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_block_mutation();

DROP TRIGGER IF EXISTS trg_ledger_transactions_immutable ON public.ledger_transactions;
CREATE TRIGGER trg_ledger_transactions_immutable
  BEFORE UPDATE OR DELETE ON public.ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION ledger_block_mutation();

-- ─── Account resolver (resolve-or-create) ─────────────────────────
-- Callers pass roles, not account ids. This finds or creates the account.
CREATE OR REPLACE FUNCTION ledger_resolve_account(
  p_owner_type ledger_owner_type,
  p_owner_id   UUID,
  p_kind       ledger_account_kind,
  p_currency   CHAR(3)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM ledger_accounts
  WHERE owner_type = p_owner_type
    AND COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(p_owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND kind = p_kind
    AND currency = p_currency;

  IF v_id IS NULL THEN
    INSERT INTO ledger_accounts (owner_type, owner_id, kind, currency)
    VALUES (p_owner_type, p_owner_id, p_kind, p_currency)
    ON CONFLICT (owner_type, COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, currency)
      DO NOTHING
    RETURNING id INTO v_id;

    -- If a concurrent call inserted it first, re-select.
    IF v_id IS NULL THEN
      SELECT id INTO v_id
      FROM ledger_accounts
      WHERE owner_type = p_owner_type
        AND COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = COALESCE(p_owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND kind = p_kind
        AND currency = p_currency;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- ─── post_journal: the ONLY write path ────────────────────────────
-- Posts a balanced journal atomically and idempotently.
--
-- p_entries is a JSONB array; each element:
--   { "owner_type": "...", "owner_id": "<uuid|null>", "kind": "...",
--     "direction": "debit"|"credit", "amount_minor": <int>, "currency": "EUR" }
--
-- Behavior:
--   * If p_idempotency_key already exists → NO-OP, returns the existing
--     transaction id (idempotent replay).
--   * Validates: >=2 entries; each amount > 0; per currency, sum(debits) ==
--     sum(credits). Raises 'check_violation' on imbalance (writes nothing).
--   * Resolves/creates each account, inserts the transaction + entries in one
--     atomic statement (the whole function runs in a single transaction).
CREATE OR REPLACE FUNCTION post_journal(
  p_idempotency_key TEXT,
  p_entries         JSONB,
  p_event_ref       TEXT DEFAULT NULL,
  p_order_id        UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_txn_id     UUID;
  v_existing   UUID;
  v_entry      JSONB;
  v_account_id UUID;
  v_count      INT;
  v_imbalance  RECORD;
BEGIN
  -- Idempotency: if we've seen this key, return the existing transaction.
  SELECT id INTO v_existing FROM ledger_transactions WHERE idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Must be a JSON array of at least 2 entries.
  IF jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'post_journal: p_entries must be a JSON array' USING ERRCODE = 'check_violation';
  END IF;
  v_count := jsonb_array_length(p_entries);
  IF v_count < 2 THEN
    RAISE EXCEPTION 'post_journal: a journal needs at least 2 entries (got %)', v_count
      USING ERRCODE = 'check_violation';
  END IF;

  -- Every amount must be a positive integer.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_entries) e
    WHERE (e->>'amount_minor')::BIGINT <= 0
  ) THEN
    RAISE EXCEPTION 'post_journal: every amount_minor must be > 0' USING ERRCODE = 'check_violation';
  END IF;

  -- Balance check: per currency, sum(debits) must equal sum(credits).
  FOR v_imbalance IN
    SELECT
      e->>'currency' AS currency,
      SUM(CASE WHEN e->>'direction' = 'debit'  THEN (e->>'amount_minor')::BIGINT ELSE 0 END) AS debits,
      SUM(CASE WHEN e->>'direction' = 'credit' THEN (e->>'amount_minor')::BIGINT ELSE 0 END) AS credits
    FROM jsonb_array_elements(p_entries) e
    GROUP BY e->>'currency'
  LOOP
    IF v_imbalance.debits <> v_imbalance.credits THEN
      RAISE EXCEPTION 'post_journal: imbalance in %: debits=% credits=%',
        v_imbalance.currency, v_imbalance.debits, v_imbalance.credits
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  -- Create the transaction. UNIQUE(idempotency_key) is the concurrency guard:
  -- if a parallel call raced us, we catch 23505 and return the winner.
  BEGIN
    INSERT INTO ledger_transactions (idempotency_key, event_ref, order_id)
    VALUES (p_idempotency_key, p_event_ref, p_order_id)
    RETURNING id INTO v_txn_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_txn_id FROM ledger_transactions WHERE idempotency_key = p_idempotency_key;
    RETURN v_txn_id;
  END;

  -- Insert the entries, resolving each account.
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_account_id := ledger_resolve_account(
      (v_entry->>'owner_type')::ledger_owner_type,
      NULLIF(v_entry->>'owner_id', '')::UUID,
      (v_entry->>'kind')::ledger_account_kind,
      (v_entry->>'currency')::CHAR(3)
    );

    INSERT INTO ledger_entries (transaction_id, account_id, direction, amount_minor, currency)
    VALUES (
      v_txn_id,
      v_account_id,
      (v_entry->>'direction')::ledger_direction,
      (v_entry->>'amount_minor')::BIGINT,
      (v_entry->>'currency')::CHAR(3)
    );
  END LOOP;

  RETURN v_txn_id;
END;
$$;

-- ─── Balance read model ───────────────────────────────────────────
-- Balance = sum of credits - debits for an account (per currency).
-- This is the ONLY way to read a balance; nothing is stored mutable.
CREATE OR REPLACE FUNCTION ledger_balance(
  p_owner_type ledger_owner_type,
  p_owner_id   UUID,
  p_kind       ledger_account_kind,
  p_currency   CHAR(3)
)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(SUM(
    CASE WHEN le.direction = 'credit' THEN le.amount_minor ELSE -le.amount_minor END
  ), 0)::BIGINT
  FROM ledger_entries le
  JOIN ledger_accounts la ON la.id = le.account_id
  WHERE la.owner_type = p_owner_type
    AND COALESCE(la.owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(p_owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND la.kind = p_kind
    AND la.currency = p_currency;
$$;

-- ─── RLS: service-role only ───────────────────────────────────────
-- Enable RLS with NO policy for authenticated/anon → those roles see zero
-- rows and cannot write. Only the service-role client (which bypasses RLS)
-- and the SECURITY DEFINER functions above touch these tables.
ALTER TABLE public.ledger_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries      ENABLE ROW LEVEL SECURITY;

-- Lock down execute: only service_role may call the write/read RPCs directly.
-- (SECURITY DEFINER means they run as owner regardless; this restricts WHO
-- can invoke them via PostgREST.)
REVOKE ALL ON FUNCTION post_journal(TEXT, JSONB, TEXT, UUID)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ledger_balance(ledger_owner_type, UUID, ledger_account_kind, CHAR) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ledger_resolve_account(ledger_owner_type, UUID, ledger_account_kind, CHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION post_journal(TEXT, JSONB, TEXT, UUID)              TO service_role;
GRANT EXECUTE ON FUNCTION ledger_balance(ledger_owner_type, UUID, ledger_account_kind, CHAR) TO service_role;
GRANT EXECUTE ON FUNCTION ledger_resolve_account(ledger_owner_type, UUID, ledger_account_kind, CHAR) TO service_role;

COMMENT ON FUNCTION post_journal(TEXT, JSONB, TEXT, UUID) IS
  'Money layer: the ONLY ledger write path. Posts a balanced, idempotent double-entry journal atomically. Service-role only.';
COMMENT ON TABLE public.ledger_entries IS
  'Append-only double-entry lines. Immutable (trigger-blocked UPDATE/DELETE). Balanced per transaction per currency by post_journal.';

-- ─── Test-only cleanup ────────────────────────────────────────────
-- The immutability trigger blocks DELETE even for the service role, which is
-- correct for production but means integration tests can't remove their own
-- namespaced rows. This helper deletes ONLY transactions (and their entries)
-- whose idempotency_key matches a prefix — integration tests namespace every
-- key under "test:ledger:<ts>:<rand>:...", so this can never touch real data.
-- It temporarily disables the immutability trigger within its own transaction.
CREATE OR REPLACE FUNCTION ledger_test_cleanup(p_prefix TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Safety rail: refuse to run unless the prefix is clearly a test namespace.
  IF p_prefix IS NULL OR p_prefix NOT LIKE 'test:ledger:%' THEN
    RAISE EXCEPTION 'ledger_test_cleanup: prefix must start with "test:ledger:" (got %)', p_prefix
      USING ERRCODE = 'check_violation';
  END IF;

  ALTER TABLE ledger_entries      DISABLE TRIGGER trg_ledger_entries_immutable;
  ALTER TABLE ledger_transactions DISABLE TRIGGER trg_ledger_transactions_immutable;

  DELETE FROM ledger_entries
  WHERE transaction_id IN (SELECT id FROM ledger_transactions WHERE idempotency_key LIKE p_prefix);

  DELETE FROM ledger_transactions WHERE idempotency_key LIKE p_prefix;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  ALTER TABLE ledger_entries      ENABLE TRIGGER trg_ledger_entries_immutable;
  ALTER TABLE ledger_transactions ENABLE TRIGGER trg_ledger_transactions_immutable;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION ledger_test_cleanup(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ledger_test_cleanup(TEXT) TO service_role;
