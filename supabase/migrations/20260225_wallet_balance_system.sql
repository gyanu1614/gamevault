-- ============================================
-- WALLET BALANCE SYSTEM
-- ============================================

-- Wallet balances for all users
CREATE TABLE IF NOT EXISTS public.wallet_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- Balance tracking
  available_balance NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  lifetime_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  lifetime_spent NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Cashback & rewards
  total_cashback NUMERIC(10,2) NOT NULL DEFAULT 0,
  referral_earnings NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wallet transaction types
DO $$ BEGIN
  CREATE TYPE wallet_transaction_type AS ENUM (
    'top_up',           -- User added money
    'purchase',         -- Deducted for order
    'refund',           -- Refunded from cancelled order
    'cashback',         -- Cashback earned
    'referral_bonus',   -- Referral reward
    'admin_adjustment', -- Manual admin adjustment
    'withdrawal'        -- Seller payout
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Wallet transactions (ledger)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Transaction details
  type wallet_transaction_type NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  balance_after NUMERIC(10,2) NOT NULL,

  -- Metadata
  description TEXT,
  reference_id UUID, -- Order ID, top-up ID, etc.
  reference_type TEXT, -- 'order', 'top_up', 'payout', etc.

  -- Payment method (for top-ups)
  payment_method TEXT, -- 'stripe', 'paypal', etc.
  payment_intent_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'reversed'

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallet_balances_user_id ON wallet_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference_id);

-- Enable RLS
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own wallet
CREATE POLICY "Users can view own wallet balance"
  ON wallet_balances FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- System can insert/update (for server actions)
CREATE POLICY "System can manage wallet balances"
  ON wallet_balances FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can manage wallet transactions"
  ON wallet_transactions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to update wallet balance
CREATE OR REPLACE FUNCTION update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert wallet balance
  INSERT INTO wallet_balances (user_id, available_balance, updated_at)
  VALUES (NEW.user_id, NEW.balance_after, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    available_balance = NEW.balance_after,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update balance
DROP TRIGGER IF EXISTS trigger_update_wallet_balance ON wallet_transactions;
CREATE TRIGGER trigger_update_wallet_balance
  AFTER INSERT ON wallet_transactions
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION update_wallet_balance();

-- Initialize wallet for existing users
INSERT INTO wallet_balances (user_id, available_balance)
SELECT id, 0
FROM profiles
WHERE NOT EXISTS (
  SELECT 1 FROM wallet_balances WHERE wallet_balances.user_id = profiles.id
)
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE wallet_balances IS 'User wallet balances with cashback and referral tracking';
COMMENT ON TABLE wallet_transactions IS 'Ledger of all wallet transactions (top-ups, purchases, refunds, etc.)';
