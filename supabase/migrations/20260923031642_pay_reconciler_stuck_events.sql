-- ============================================================================
-- Checkout fix round B, Part 4 — stuck-webhook reconciler + poison counters
-- (PAY-010 / PAY-012). Idempotent: safe to re-run.
--
-- PAY-010: a webhook that crashed between webhook_event_claim and
-- webhook_event_mark left its row `received`; every provider retry deduped
-- to 200 and the payment was never applied. webhook_events now stores the
-- VERIFIED canonical events at claim time (p_events) so a stuck row can be
-- re-run through the same dispatch by /api/cron/reconcile-payments, with a
-- per-row attempt counter, a cap, and ONE admin alert for a poison row.
-- Rows claimed before this migration carry no events and cannot be
-- replayed: they are flipped to `failed`, which the provider's own retry
-- re-claims (DB-015d).
--
-- PAY-012: the expiry sweep retried a failing order every 30 minutes
-- forever, silently. payment_attempts.sweep_failures counts them; the cap
-- alerts admins once and expired_pending_payment_attempts stops returning
-- the row, so it can neither spam nor starve the batch.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.payment_reconciler_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.payment_reconciler_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_reconciler_version() TO service_role;

-- ── 1. webhook_events: stored events + reconcile bookkeeping ────────────────
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS events             jsonb,
  ADD COLUMN IF NOT EXISTS reconcile_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error         text;
COMMENT ON COLUMN public.webhook_events.events IS 'Round B Part 4: the verified canonical events (lib/payments/webhook-events-serde), stored at claim so a row stuck received can be re-run by the reconciler.';
COMMENT ON COLUMN public.webhook_events.reconcile_attempts IS 'Round B Part 4: times the reconciler re-ran this row; capped (5) → failed + one admin alert.';

DROP FUNCTION IF EXISTS public.webhook_event_claim(text, text, text);
CREATE OR REPLACE FUNCTION public.webhook_event_claim(
  p_provider text, p_provider_event_id text, p_payload_hash text DEFAULT NULL, p_events jsonb DEFAULT NULL)
  RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_claimed UUID;
BEGIN
  INSERT INTO webhook_events (provider, provider_event_id, payload_hash, events)
  VALUES (p_provider, p_provider_event_id, p_payload_hash, p_events)
  ON CONFLICT (provider, provider_event_id) DO UPDATE
    SET status = 'received', result = NULL, last_error = NULL,
        payload_hash = COALESCE(EXCLUDED.payload_hash, webhook_events.payload_hash),
        events = COALESCE(EXCLUDED.events, webhook_events.events)
    WHERE webhook_events.status = 'failed'
  RETURNING id INTO v_claimed;
  RETURN v_claimed IS NOT NULL;  -- TRUE = freshly claimed (new or re-run of a failed one); FALSE = duplicate
END;
$$;
REVOKE ALL ON FUNCTION public.webhook_event_claim(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_event_claim(text, text, text, jsonb) TO service_role;
COMMENT ON FUNCTION public.webhook_event_claim(text, text, text, jsonb) IS
  'Webhook dedupe claim. TRUE for a new event or for one whose previous run ended failed (provider retry = replay); FALSE for received/processed. Stores the verified events for the reconciler. Service-role only.';

-- ── 2. rows that cannot be replayed → failed (the provider retry re-claims)
CREATE OR REPLACE FUNCTION public.webhook_events_flip_unreplayable(p_older_than_minutes integer DEFAULT 15)
  RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE webhook_events
     SET status = 'failed',
         last_error = 'stuck received with no stored events (claimed before round B) — flipped to failed so the provider retry re-claims it',
         last_reconciled_at = now()
   WHERE status = 'received' AND events IS NULL
     AND received_at < now() - make_interval(mins => GREATEST(1, p_older_than_minutes));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.webhook_events_flip_unreplayable(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_events_flip_unreplayable(integer) TO service_role;

-- ── 3. claim stuck rows (skip-locked, attempts bumped, spaced by the window)
CREATE OR REPLACE FUNCTION public.webhook_events_stuck_claim(p_older_than_minutes integer DEFAULT 15, p_limit integer DEFAULT 50)
  RETURNS SETOF public.webhook_events
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window interval := make_interval(mins => GREATEST(1, p_older_than_minutes));
BEGIN
  RETURN QUERY
  UPDATE webhook_events w
     SET reconcile_attempts = w.reconcile_attempts + 1,
         last_reconciled_at = now()
   WHERE w.id IN (
     SELECT c.id FROM webhook_events c
      WHERE c.status = 'received' AND c.events IS NOT NULL
        AND c.received_at < now() - v_window
        AND (c.last_reconciled_at IS NULL OR c.last_reconciled_at < now() - v_window)
      ORDER BY c.received_at
      FOR UPDATE SKIP LOCKED
      LIMIT GREATEST(1, p_limit))
  RETURNING w.*;
END;
$$;
REVOKE ALL ON FUNCTION public.webhook_events_stuck_claim(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_events_stuck_claim(integer, integer) TO service_role;

-- ── 4. mark a reconcile run: processed | received (retry) | failed + alert ──
CREATE OR REPLACE FUNCTION public.webhook_event_reconcile_mark(p_id uuid, p_ok boolean, p_error text, p_max_attempts integer DEFAULT 5)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row     webhook_events%ROWTYPE;
  v_alerted integer := 0;
BEGIN
  SELECT * INTO v_row FROM webhook_events WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'webhook_event_reconcile_mark: row % not found', p_id USING ERRCODE = 'no_data_found';
  END IF;
  IF p_ok THEN
    UPDATE webhook_events
       SET status = 'processed', processed_at = now(), last_error = NULL,
           result = jsonb_build_object('reconciled', true, 'attempts', v_row.reconcile_attempts)
     WHERE id = p_id;
    RETURN jsonb_build_object('id', p_id, 'status', 'processed', 'attempts', v_row.reconcile_attempts, 'alerted', 0);
  END IF;
  IF v_row.reconcile_attempts >= GREATEST(1, p_max_attempts) THEN
    UPDATE webhook_events SET status = 'failed', last_error = p_error, result = jsonb_build_object('poisoned', true) WHERE id = p_id;
    v_alerted := admin_alert_once(
      'payment_review',
      'Webhook Event Poisoned',
      'Webhook event ' || v_row.provider || '/' || v_row.provider_event_id || ' failed ' || v_row.reconcile_attempts ||
        ' reconcile attempts (' || COALESCE(LEFT(p_error, 160), 'no detail') ||
        '). It is marked failed; the provider''s next retry re-runs it, or replay it by hand once the cause is fixed.',
      '/admin/orders?webhook=' || v_row.provider || ':' || v_row.provider_event_id);
    RETURN jsonb_build_object('id', p_id, 'status', 'failed', 'attempts', v_row.reconcile_attempts, 'alerted', v_alerted);
  END IF;
  UPDATE webhook_events SET last_error = p_error WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'received', 'attempts', v_row.reconcile_attempts, 'alerted', 0);
END;
$$;
REVOKE ALL ON FUNCTION public.webhook_event_reconcile_mark(uuid, boolean, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.webhook_event_reconcile_mark(uuid, boolean, text, integer) TO service_role;

-- ── 5. PAY-012: the sweep's per-attempt failure counter ─────────────────────
ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS sweep_failures   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sweep_last_error text;
COMMENT ON COLUMN public.payment_attempts.sweep_failures IS 'Round B Part 4 (PAY-012): consecutive expiry-sweep failures on this attempt; at 5 the row leaves the sweep and admins are alerted once.';

CREATE OR REPLACE FUNCTION public.payment_attempt_note_sweep_failure(p_attempt_id uuid, p_error text)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c_max     CONSTANT integer := 5;
  v_a       RECORD;
  v_n       integer;
  v_alerted integer := 0;
BEGIN
  UPDATE payment_attempts
     SET sweep_failures = sweep_failures + 1, sweep_last_error = LEFT(p_error, 500)
   WHERE id = p_attempt_id
   RETURNING sweep_failures INTO v_n;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_attempt_note_sweep_failure: attempt % not found', p_attempt_id USING ERRCODE = 'no_data_found';
  END IF;
  SELECT sweep_failures, order_id, provider, provider_charge_id INTO v_a FROM payment_attempts WHERE id = p_attempt_id;
  IF v_a.sweep_failures >= c_max THEN
    v_alerted := admin_alert_once(
      'payment_review',
      'Expiry Sweep Poisoned Order',
      'Order ' || UPPER(LEFT(v_a.order_id::text, 8)) || ' (charge ' || v_a.provider || '/' || COALESCE(v_a.provider_charge_id, 'none') ||
        ') could not be expired after ' || v_a.sweep_failures || ' sweep runs (' || COALESCE(LEFT(p_error, 160), 'no detail') ||
        '). The sweep now skips it; cancel it by hand or fix the cause and reset payment_attempts.sweep_failures.',
      '/account/orders/' || v_a.order_id::text);
  END IF;
  RETURN jsonb_build_object('attempt_id', p_attempt_id, 'sweep_failures', v_a.sweep_failures, 'alerted', v_alerted);
END;
$$;
REVOKE ALL ON FUNCTION public.payment_attempt_note_sweep_failure(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_attempt_note_sweep_failure(uuid, text) TO service_role;

-- expired_pending_payment_attempts: poison rows leave the batch.
CREATE OR REPLACE FUNCTION public.expired_pending_payment_attempts(p_cutoff timestamptz, p_limit integer DEFAULT 50)
  RETURNS TABLE (order_id uuid, attempt_id uuid, provider text, provider_charge_id text, expires_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, a.id, COALESCE(a.provider, o.payment_provider), a.provider_charge_id,
         COALESCE(a.expires_at, o.payment_expires_at)
    FROM orders o
    LEFT JOIN payment_attempts a ON a.order_id = o.id AND a.status IN ('created', 'active')
   WHERE o.status = 'pending'
     AND COALESCE(a.expires_at, o.payment_expires_at) < p_cutoff
     AND COALESCE(a.sweep_failures, 0) < 5
   ORDER BY COALESCE(a.expires_at, o.payment_expires_at) ASC
   LIMIT GREATEST(1, p_limit);
$$;
REVOKE ALL ON FUNCTION public.expired_pending_payment_attempts(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expired_pending_payment_attempts(timestamptz, integer) TO service_role;
COMMENT ON FUNCTION public.expired_pending_payment_attempts(timestamptz, integer) IS
  'Round B: pending orders whose OPEN attempt (or, with none, the order''s fallback expiry) is past p_cutoff, oldest first; attempts with 5+ sweep failures are left out (PAY-012). Read by /api/cron/expire-pending-payments. Service-role only.';
