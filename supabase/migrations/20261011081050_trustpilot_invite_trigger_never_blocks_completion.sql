-- Trustpilot invite trigger must never block an order completion (B4).
--
-- schedule_trustpilot_invitation runs AFTER UPDATE OF status ON orders, inside
-- the completion's own transaction. It copied profiles.email (nullable) into
-- trustpilot_invitations.email (NOT NULL), so a buyer with no email made the
-- completion roll back: the order could not complete at all. Reproduced on the
-- local stack 2026-10-11.
--
--   * email becomes nullable: a missing address is the sender's problem to
--     record (status 'skipped'), never the completion's.
--   * the body is wrapped so ANY error is logged as a WARNING and swallowed:
--     an invite is best-effort, a completion is money.
--   * SECURITY DEFINER pins search_path (CLAUDE.md rule; the baseline did not).
--   * generate_trustpilot_token (BEFORE INSERT on the invites table) called
--     gen_random_bytes unqualified; it only resolved through the session's
--     default path. Under the pinned path above it raised 42883 and no invite
--     was ever written, so it now names extensions.gen_random_bytes and pins
--     its own path too.

ALTER TABLE public.trustpilot_invitations ALTER COLUMN email DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_trustpilot_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invitation_token IS NULL THEN
    NEW.invitation_token = encode(extensions.gen_random_bytes(32), 'base64');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_trustpilot_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  buyer_email text;
  days_delay integer := 7;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    BEGIN
      SELECT email INTO buyer_email FROM public.profiles WHERE id = NEW.buyer_id;

      INSERT INTO public.trustpilot_invitations (buyer_id, order_id, email, scheduled_for)
      VALUES (NEW.buyer_id, NEW.id, buyer_email, now() + make_interval(days => days_delay))
      ON CONFLICT (order_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_trustpilot_invitation: order % not scheduled (%: %)', NEW.id, SQLSTATE, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- CREATE OR REPLACE keeps the existing grants (service_role only since
-- 20260913100000); restated so the posture is visible here.
REVOKE ALL ON FUNCTION public.schedule_trustpilot_invitation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_trustpilot_invitation() TO service_role;
