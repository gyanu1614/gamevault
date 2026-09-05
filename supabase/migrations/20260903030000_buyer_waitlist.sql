-- Buyer Waitlist. Idempotent.
--
-- Notify-me email capture for the "Buying Opens Soon" gate: buyers who try to
-- purchase while PURCHASES_ENABLED is off leave an email and get pinged at
-- launch. Mirrors the early_seller_signups pattern: RLS-locked with NO public
-- policies — all writes go through the service-role server action, which
-- sanitizes input and treats duplicate emails as "already on the list".

CREATE TABLE IF NOT EXISTS public.buyer_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  -- What they tried to buy (nullable — the gate may also capture from generic spots).
  listing_id uuid,
  game_slug text,
  source text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_waitlist_email_unique UNIQUE (email)
);

ALTER TABLE public.buyer_waitlist ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_buyer_waitlist_created_at
  ON public.buyer_waitlist (created_at DESC);
