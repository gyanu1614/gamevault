-- Trustpilot review invites: an honest status per invite, a buyer opt-out,
-- and the owner's review-count switch for the public TrustBox.
--
-- How an invite is sent (src/lib/trustpilot/invite.ts): the buyer's
-- order-complete receipt is BCC'd to Trustpilot's Automatic Feedback address
-- with a structured snippet (recipient, order number), and Trustpilot sends
-- its own invite after the delay set in its dashboard. The BCC is added ONLY
-- for a qualifying order (completed by buyer confirmation or auto-release,
-- no test account on either side, buyer has an email and has not opted out,
-- no dispute). Stars are never looked at: every qualifying order is invited.
--
-- Until now sent_at was stamped by the daily cron 7 days after completion
-- whether or not the receipt (and its BCC) ever went out. From here:
--   scheduled  the completion happened; the send has not been attempted yet
--   sent       the receipt with the BCC was accepted by the email provider
--   failed     the provider refused it; the cron retries (max 3 attempts)
--   skipped    the order does not qualify (skip_reason says why)
--
-- 1. trustpilot_invitations: status + attempt bookkeeping; the trigger now
--    makes the row due one hour after completion (the completion path sends
--    straight away; the cron only picks up what that path missed).
-- 2. email_preferences.review_invites (default on) — Settings → Notifications.
-- 3. trustpilot_settings (one row): review_count, set by an admin on /admin.
--    The public TrustBox shows only at 10+ reviews; public read of that one
--    column so static pages read it through the anon client.
-- 4. trustpilot_invite_stats(since): counts per status for the /admin card.

-- ── 1. invite status ────────────────────────────────────────────────────────
ALTER TABLE public.trustpilot_invitations
  ADD COLUMN IF NOT EXISTS status          text        NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS skip_reason     text,
  ADD COLUMN IF NOT EXISTS attempts        integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error      text;

ALTER TABLE public.trustpilot_invitations
  DROP CONSTRAINT IF EXISTS trustpilot_invitations_status_check;
ALTER TABLE public.trustpilot_invitations
  ADD CONSTRAINT trustpilot_invitations_status_check
  CHECK (status IN ('scheduled', 'sent', 'failed', 'skipped'));

COMMENT ON COLUMN public.trustpilot_invitations.status IS
  'scheduled | sent (receipt with the Trustpilot BCC accepted by the email provider) | failed (provider refused; cron retries, max 3 attempts) | skipped (order does not qualify — see skip_reason)';
COMMENT ON COLUMN public.trustpilot_invitations.sent_at IS
  'When the receipt carrying the Trustpilot BCC was accepted by the email provider. Rows from before 2026-10-11 were stamped by the old cron without that check.';
COMMENT ON COLUMN public.trustpilot_invitations.scheduled_for IS
  'When the cron may pick the row up if the completion path did not send it (completion + 1 hour). Trustpilot''s own invite delay is set in its dashboard.';

-- Backfill: before this, the BCC rode on every buyer-confirmed / auto-released
-- receipt from the moment it was completed, so those rows are recorded as
-- sent (they cannot be verified after the fact). Dispute and admin completions
-- never got a receipt, so no BCC: skipped.
UPDATE public.trustpilot_invitations t
   SET status = CASE WHEN o.release_method IN ('buyer_confirmed', 'auto') THEN 'sent' ELSE 'skipped' END,
       skip_reason = CASE WHEN o.release_method IN ('buyer_confirmed', 'auto') THEN NULL ELSE 'dispute' END,
       sent_at = CASE WHEN o.release_method IN ('buyer_confirmed', 'auto') THEN coalesce(t.sent_at, o.completed_at) ELSE NULL END
  FROM public.orders o
 WHERE o.id = t.order_id
   AND t.status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_trustpilot_invitations_due
  ON public.trustpilot_invitations (scheduled_for)
  WHERE status IN ('scheduled', 'failed');

CREATE OR REPLACE FUNCTION public.schedule_trustpilot_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  buyer_email text;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    BEGIN
      SELECT email INTO buyer_email FROM public.profiles WHERE id = NEW.buyer_id;

      INSERT INTO public.trustpilot_invitations (buyer_id, order_id, email, scheduled_for, status)
      VALUES (NEW.buyer_id, NEW.id, buyer_email, now() + interval '1 hour', 'scheduled')
      ON CONFLICT (order_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_trustpilot_invitation: order % not scheduled (%: %)', NEW.id, SQLSTATE, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.schedule_trustpilot_invitation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_trustpilot_invitation() TO service_role;

-- ── 2. buyer opt-out ────────────────────────────────────────────────────────
ALTER TABLE public.email_preferences
  ADD COLUMN IF NOT EXISTS review_invites boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.email_preferences.review_invites IS
  'Off: the order-complete receipt goes out without the Trustpilot BCC, so Trustpilot never invites this buyer.';

-- ── 3. review-count switch ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trustpilot_settings (
  id           smallint    PRIMARY KEY DEFAULT 1,
  review_count integer     NOT NULL DEFAULT 0,
  updated_by   uuid,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trustpilot_settings_singleton CHECK (id = 1),
  CONSTRAINT trustpilot_settings_review_count_check CHECK (review_count >= 0)
);
COMMENT ON TABLE public.trustpilot_settings IS
  'Single row. review_count = reviews on our Trustpilot profile, set by an admin on /admin. The public TrustBox renders only at 10 or more.';

INSERT INTO public.trustpilot_settings (id, review_count) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.trustpilot_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.trustpilot_settings FROM anon, authenticated;
GRANT SELECT (id, review_count) ON TABLE public.trustpilot_settings TO anon, authenticated;
DROP POLICY IF EXISTS trustpilot_settings_public_read ON public.trustpilot_settings;
CREATE POLICY trustpilot_settings_public_read ON public.trustpilot_settings
  FOR SELECT TO anon, authenticated USING (true);

-- ── 4. admin stats ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trustpilot_invite_stats(p_since timestamptz)
RETURNS TABLE (scheduled bigint, sent bigint, failed bigint, skipped bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FILTER (WHERE status = 'scheduled'),
         count(*) FILTER (WHERE status = 'sent'),
         count(*) FILTER (WHERE status = 'failed'),
         count(*) FILTER (WHERE status = 'skipped')
    FROM public.trustpilot_invitations
   WHERE created_at >= p_since;
$$;
REVOKE ALL ON FUNCTION public.trustpilot_invite_stats(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trustpilot_invite_stats(timestamptz) TO service_role;
