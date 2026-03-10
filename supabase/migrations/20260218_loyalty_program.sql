-- P5.2 — Buyer Loyalty & Cashback Program
-- Adds loyalty_balance to profiles and creates loyalty_credits ledger table

-- ── Add loyalty_balance to profiles ──────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS loyalty_balance NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (loyalty_balance >= 0),
  ADD COLUMN IF NOT EXISTS lifetime_cashback_earned NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- ── Loyalty credits ledger ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_credits (
  id              UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id        UUID         REFERENCES orders(id) ON DELETE SET NULL,
  type            TEXT         NOT NULL CHECK (type IN ('earned', 'redeemed', 'bonus', 'expired')),
  amount          NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  balance_after   NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (balance_after >= 0),
  description     TEXT         NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS loyalty_credits_user_id_idx  ON loyalty_credits(user_id);
CREATE INDEX IF NOT EXISTS loyalty_credits_order_id_idx ON loyalty_credits(order_id);
CREATE INDEX IF NOT EXISTS loyalty_credits_created_at_idx ON loyalty_credits(created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE loyalty_credits ENABLE ROW LEVEL SECURITY;

-- Users can only read their own credits
CREATE POLICY "loyalty_credits_select_own"
  ON loyalty_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role (server actions) can insert
CREATE POLICY "loyalty_credits_insert_service"
  ON loyalty_credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all
CREATE POLICY "loyalty_credits_admin_select"
  ON loyalty_credits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
