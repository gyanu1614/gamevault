-- Migration: Fix sent_at dispatch semantics on trustpilot_invitations
-- Date: 2026-07-14
--
-- The cron job (/api/cron/send-trustpilot-invitations) selects rows
-- WHERE sent_at IS NULL to find invitations that have not been dispatched
-- yet. But the original table definition (20260206) declared
-- sent_at NOT NULL DEFAULT now(), so every row created by the
-- schedule_trustpilot_invitation() order-completion trigger was born with
-- a non-null sent_at and the cron could never match anything: the whole
-- invitation pipeline was dead on arrival.
--
-- New semantics: sent_at IS NULL = scheduled but not yet dispatched;
-- sendTrustpilotInvitation() stamps sent_at = now() only after a
-- successful dispatch (Trustpilot API or fallback email).

ALTER TABLE public.trustpilot_invitations
  ALTER COLUMN sent_at DROP NOT NULL,
  ALTER COLUMN sent_at DROP DEFAULT;

-- Backfill: nothing has ever actually been dispatched (the cron filter
-- could never match, and no other caller exists), so clear the bogus
-- default timestamps on every row that has not been reviewed. Rows with
-- review_submitted = true are left untouched — the send path skips them
-- regardless via its review_submitted guard.
UPDATE public.trustpilot_invitations
SET sent_at = NULL
WHERE review_submitted = false;

COMMENT ON COLUMN public.trustpilot_invitations.sent_at IS
  'When the invitation was actually dispatched (Trustpilot API or fallback email). NULL = scheduled, not yet sent — the daily cron picks these up.';
