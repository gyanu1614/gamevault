-- ============================================================
-- P2.1: Stripe Connect — Seller Payout System
-- Created: 2026-02-17
-- Purpose:
--   Enable sellers to connect their bank account via Stripe Connect
--   and receive payouts when escrow is released.
--
--   14-day payout hold for new sellers (fraud protection):
--   - Sellers with < 3 completed orders or < 14 days account age
--   - Hold lifted automatically after threshold met
-- ============================================================

-- ─── Step 1: Add Stripe Connect columns to profiles ───────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id    TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_status        TEXT DEFAULT 'not_connected'
    CHECK (stripe_connect_status IN ('not_connected', 'pending', 'restricted', 'active', 'disabled')),
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_url    TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_connected_at      TIMESTAMPTZ,
  -- Seller earnings balance (released escrow, not yet withdrawn)
  ADD COLUMN IF NOT EXISTS seller_balance               DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  -- Pending balance (in escrow, not yet released)
  ADD COLUMN IF NOT EXISTS pending_balance              DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  -- Lifetime earnings
  ADD COLUMN IF NOT EXISTS lifetime_earnings            DECIMAL(12,2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN profiles.stripe_connect_account_id
  IS 'Stripe Connect Express account ID (acct_...). NULL if not connected.';
COMMENT ON COLUMN profiles.stripe_connect_status
  IS 'Connect account status: not_connected|pending|restricted|active|disabled';
COMMENT ON COLUMN profiles.seller_balance
  IS 'Available balance for withdrawal. Incremented when escrow is released.';
COMMENT ON COLUMN profiles.pending_balance
  IS 'Funds held in escrow (paid orders not yet completed).';
COMMENT ON COLUMN profiles.lifetime_earnings
  IS 'Total lifetime seller earnings (all-time released escrow). Never decremented.';

-- ─── Step 2: Create payouts table ────────────────────────────

CREATE TABLE IF NOT EXISTS payouts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Stripe Transfer ID (tr_...)
  stripe_transfer_id    TEXT UNIQUE,
  -- Stripe Payout ID (po_...) — the final bank transfer
  stripe_payout_id      TEXT,
  amount                DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency              TEXT NOT NULL DEFAULT 'usd',
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  -- The order this payout is for (NULL for manual bulk payouts)
  order_id              UUID REFERENCES orders(id) ON DELETE SET NULL,
  -- When the payout was initiated / completed
  initiated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  failure_reason        TEXT,
  -- 14-day hold for new sellers
  hold_until            TIMESTAMPTZ,
  is_held               BOOLEAN NOT NULL DEFAULT FALSE,
  -- Metadata
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_seller ON payouts (seller_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts (status);
CREATE INDEX IF NOT EXISTS idx_payouts_order  ON payouts (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payouts_hold   ON payouts (hold_until) WHERE is_held = TRUE;

-- ─── Step 3: RLS for payouts ──────────────────────────────────

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Sellers can see their own payouts
DROP POLICY IF EXISTS "Sellers can view own payouts" ON payouts;
CREATE POLICY "Sellers can view own payouts"
  ON payouts FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- Admins can see all payouts
DROP POLICY IF EXISTS "Admins can view all payouts" ON payouts;
CREATE POLICY "Admins can view all payouts"
  ON payouts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  );

-- Only service role can insert payouts
DROP POLICY IF EXISTS "Service role can manage payouts" ON payouts;
CREATE POLICY "Service role can manage payouts"
  ON payouts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Step 4: Function to increment seller balance on escrow release ──

CREATE OR REPLACE FUNCTION release_escrow_to_seller_balance(
  p_order_id UUID,
  p_seller_id UUID,
  p_amount    DECIMAL(12,2)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Increment seller's available balance
  UPDATE profiles
  SET
    seller_balance   = seller_balance + p_amount,
    pending_balance  = GREATEST(0, pending_balance - p_amount),
    lifetime_earnings = lifetime_earnings + p_amount
  WHERE id = p_seller_id;

  -- Log to audit
  INSERT INTO audit_logs (action, table_name, record_id, new_data, performed_by, created_at)
  VALUES (
    'ESCROW_RELEASED_TO_BALANCE',
    'orders',
    p_order_id::TEXT,
    jsonb_build_object('seller_id', p_seller_id, 'amount', p_amount),
    NULL,  -- system action
    NOW()
  );
END;
$$;

COMMENT ON FUNCTION release_escrow_to_seller_balance
  IS 'P2.1: Called by cron/auto-release when escrow is released. Moves funds from pending to available balance.';

-- ─── Step 5: Function to check 14-day hold eligibility ───────

CREATE OR REPLACE FUNCTION seller_is_in_payout_hold(p_seller_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed_orders INTEGER;
  v_account_age_days INTEGER;
BEGIN
  -- Count completed orders
  SELECT COUNT(*) INTO v_completed_orders
  FROM orders
  WHERE seller_id = p_seller_id
    AND status = 'completed';

  -- Account age in days
  SELECT EXTRACT(DAY FROM NOW() - created_at)::INTEGER INTO v_account_age_days
  FROM profiles
  WHERE id = p_seller_id;

  -- Hold if < 3 completed orders OR < 14 days old
  RETURN (v_completed_orders < 3 OR v_account_age_days < 14);
END;
$$;

COMMENT ON FUNCTION seller_is_in_payout_hold
  IS 'P2.1: Returns TRUE if seller should have a 14-day hold on payouts (new account protection).';
