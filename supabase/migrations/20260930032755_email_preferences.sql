-- Email preferences: the switches on Settings → Notifications (2026-09-29).
--
-- Before this, the switches were client-side only: nothing was stored and
-- every optional email went out regardless. One row per user; no row means
-- the defaults below (service emails on, marketing off — marketing is opt-in).
--
-- Read by src/lib/email/preferences.ts (emailAllowed) before each optional
-- email: new order (seller), new message, new review (seller), withdrawal
-- paid. Receipts, delivery, disputes, refunds and withdrawal requested /
-- approved / rejected emails are not optional and never read this table.
--
-- Service-role only: the app reads and writes it through the server actions
-- in src/lib/actions/email-preferences.ts, pinned to the session user. No
-- anon/authenticated grants and no policies, so the table-posture guard
-- passes untouched (RLS on, zero policies = deny for the public keys).

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id          uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  new_order        boolean NOT NULL DEFAULT true,
  new_message      boolean NOT NULL DEFAULT true,
  new_review       boolean NOT NULL DEFAULT true,
  payout_processed boolean NOT NULL DEFAULT true,
  marketing        boolean NOT NULL DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_preferences FROM anon, authenticated;
GRANT ALL ON TABLE public.email_preferences TO service_role;

COMMENT ON TABLE public.email_preferences IS
  'Per-user email switches (Settings → Notifications). Service-role only; see src/lib/email/preferences.ts.';
