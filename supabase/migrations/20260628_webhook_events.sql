-- ============================================================
-- MONEY LAYER — Phase 3: webhook_events dedupe table + intake RPC
-- Created: 2026-06-28
--
-- The replay/duplicate shield for inbound provider webhooks. Providers retry
-- (CoinGate up to ~hours, Tazapay 24h), so the SAME event arrives multiple
-- times. We dedupe on a UNIQUE key before dispatching, so a repeated `paid`
-- can never double-post to the ledger.
--
-- Dedupe key = (provider, provider_event_id). The adapter builds
-- provider_event_id as a stable string that includes the status (e.g.
-- "<chargeId>:paid"), so distinct status changes for the same charge each get
-- their own row, but a true replay of the same status is caught.
--
-- `status` tracks the processing lifecycle (received -> processed / failed) so
-- a crash AFTER the dedupe-insert but BEFORE dispatch can be found + retried
-- (hardening §F: webhook reprocessing). The intake RPC claims-or-skips
-- atomically via INSERT ... ON CONFLICT DO NOTHING.
--
-- Service-role only: RLS enabled, no policy for authenticated/anon. Only the
-- service-role client (the webhook route) and the SECURITY DEFINER RPC touch it.
--
-- Idempotent migration.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE webhook_event_status AS ENUM ('received', 'processed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          TEXT NOT NULL,                 -- 'coingate' | 'tazapay' | 'fake' | ...
  provider_event_id TEXT NOT NULL,                 -- stable per (charge,status), e.g. "abc123:paid"
  status            webhook_event_status NOT NULL DEFAULT 'received',
  payload_hash      TEXT,                          -- sha/hash of raw body, for audit (never the raw secret)
  result            JSONB,                         -- dispatch outcome / error detail
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,
  UNIQUE (provider, provider_event_id)             -- THE dedupe guard
);

CREATE INDEX IF NOT EXISTS webhook_events_unprocessed_idx
  ON public.webhook_events (received_at)
  WHERE status <> 'processed';                     -- partial index for the replay worker (Phase 6)

-- ─── Intake claim: insert-or-skip atomically ──────────────────────
-- Returns TRUE if THIS call claimed the event (caller should process it),
-- FALSE if it was already seen (caller no-ops → idempotent). The UNIQUE
-- constraint + ON CONFLICT DO NOTHING makes the claim race-safe across
-- concurrent retries.
CREATE OR REPLACE FUNCTION webhook_event_claim(
  p_provider          TEXT,
  p_provider_event_id TEXT,
  p_payload_hash      TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_inserted UUID;
BEGIN
  INSERT INTO webhook_events (provider, provider_event_id, payload_hash)
  VALUES (p_provider, p_provider_event_id, p_payload_hash)
  ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING id INTO v_inserted;

  RETURN v_inserted IS NOT NULL;  -- TRUE = freshly claimed; FALSE = duplicate
END;
$$;

-- ─── Mark an event's processing outcome ───────────────────────────
CREATE OR REPLACE FUNCTION webhook_event_mark(
  p_provider          TEXT,
  p_provider_event_id TEXT,
  p_status            webhook_event_status,
  p_result            JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  UPDATE webhook_events
     SET status = p_status,
         result = p_result,
         processed_at = CASE WHEN p_status = 'processed' THEN NOW() ELSE processed_at END
   WHERE provider = p_provider AND provider_event_id = p_provider_event_id;
$$;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION webhook_event_claim(TEXT, TEXT, TEXT)                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION webhook_event_mark(TEXT, TEXT, webhook_event_status, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION webhook_event_claim(TEXT, TEXT, TEXT)                       TO service_role;
GRANT EXECUTE ON FUNCTION webhook_event_mark(TEXT, TEXT, webhook_event_status, JSONB) TO service_role;

COMMENT ON TABLE public.webhook_events IS
  'Money layer: inbound webhook dedupe + processing-lifecycle shield. UNIQUE(provider, provider_event_id) prevents double-dispatch on provider retries. Service-role only.';
