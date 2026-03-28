-- =====================================================
-- Withdrawal System Migration
-- Created: March 27, 2026
-- Purpose: Complete withdrawal system for buyers and sellers
-- =====================================================

-- ─── Withdrawal Methods Configuration Table ──────────────────────────────────

CREATE TABLE IF NOT EXISTS withdrawal_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_name TEXT NOT NULL UNIQUE, -- 'bank', 'paypal', 'payoneer', 'btc', 'eth', 'usdc_erc20', 'usdc_trc20'
  display_name TEXT NOT NULL,
  method_type TEXT NOT NULL CHECK (method_type IN ('fiat', 'crypto')),
  fee_percentage DECIMAL(5,2) DEFAULT 0, -- e.g., 2.50 for 2.5%
  fee_fixed DECIMAL(10,2) DEFAULT 0, -- Fixed fee in USD (or crypto amount for crypto)
  fee_currency TEXT DEFAULT 'USD', -- USD, BTC, ETH, USDC
  min_withdrawal DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  max_withdrawal DECIMAL(10,2) NOT NULL DEFAULT 10000.00,
  processing_time TEXT, -- e.g., "2-5 business days"
  is_active BOOLEAN DEFAULT true,
  requires_kyc BOOLEAN DEFAULT false,
  icon_name TEXT, -- lucide-react icon name
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Withdrawal Requests Table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  method_id UUID NOT NULL REFERENCES withdrawal_methods(id),
  method_name TEXT NOT NULL, -- Denormalized for history

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Awaiting admin review
    'approved',     -- Admin approved, processing payment
    'processing',   -- Payment in progress
    'completed',    -- Successfully paid out
    'rejected',     -- Admin rejected
    'cancelled',    -- User cancelled before approval
    'failed'        -- Payment failed
  )),

  -- Fee calculation (stored for transparency)
  fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  fee_percentage DECIMAL(5,2),
  net_amount DECIMAL(10,2) NOT NULL, -- amount - fee_amount

  -- Payment details (JSON for flexibility)
  payment_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Examples:
  -- Bank: {"account_number": "xxx", "routing_number": "xxx", "account_name": "xxx", "bank_name": "xxx"}
  -- PayPal/Payoneer: {"email": "user@example.com"}
  -- Crypto: {"address": "0x...", "network": "ethereum"}

  -- Admin workflow
  admin_notes TEXT,
  processed_by UUID REFERENCES profiles(id), -- Admin who processed
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Transaction reference
  transaction_hash TEXT, -- For crypto withdrawals
  payment_reference TEXT, -- For bank/paypal reference numbers

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawal_requests_created_at ON withdrawal_requests(created_at DESC);
CREATE INDEX idx_withdrawal_methods_active ON withdrawal_methods(is_active) WHERE is_active = true;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

-- Enable RLS
ALTER TABLE withdrawal_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Withdrawal Methods: Public read for active methods
CREATE POLICY "Anyone can view active withdrawal methods"
  ON withdrawal_methods FOR SELECT
  USING (is_active = true);

-- Withdrawal Methods: Admin full access
CREATE POLICY "Admins can manage withdrawal methods"
  ON withdrawal_methods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Withdrawal Requests: Users can view their own
CREATE POLICY "Users can view their own withdrawal requests"
  ON withdrawal_requests FOR SELECT
  USING (user_id = auth.uid());

-- Withdrawal Requests: Users can create their own
CREATE POLICY "Users can create withdrawal requests"
  ON withdrawal_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Withdrawal Requests: Users can cancel their pending requests
CREATE POLICY "Users can cancel pending withdrawal requests"
  ON withdrawal_requests FOR UPDATE
  USING (
    user_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'cancelled'
  );

-- Withdrawal Requests: Admins can view all
CREATE POLICY "Admins can view all withdrawal requests"
  ON withdrawal_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Withdrawal Requests: Admins can update (approve/reject)
CREATE POLICY "Admins can manage withdrawal requests"
  ON withdrawal_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ─── Seed Data: Withdrawal Methods ───────────────────────────────────────────

INSERT INTO withdrawal_methods (
  method_name, display_name, method_type, fee_percentage, fee_fixed, fee_currency,
  min_withdrawal, max_withdrawal, processing_time, icon_name, description, is_active
) VALUES
  -- Fiat Methods
  (
    'bank',
    'Bank Transfer',
    'fiat',
    2.00,
    2.00,
    'USD',
    25.00,
    10000.00,
    '3-5 business days',
    'Building2',
    'Direct deposit to your bank account. ACH or wire transfer available.',
    true
  ),
  (
    'paypal',
    'PayPal',
    'fiat',
    3.50,
    1.00,
    'USD',
    10.00,
    5000.00,
    '1-2 business days',
    'Wallet',
    'Instant transfer to your PayPal account. PayPal fees may apply.',
    true
  ),
  (
    'payoneer',
    'Payoneer',
    'fiat',
    3.00,
    1.00,
    'USD',
    20.00,
    10000.00,
    '2-3 business days',
    'CreditCard',
    'Transfer to your Payoneer account. Global payments supported.',
    true
  ),

  -- Crypto Methods
  (
    'btc',
    'Bitcoin (BTC)',
    'crypto',
    0.00,
    0.0005,
    'BTC',
    50.00,
    50000.00,
    '30-60 minutes',
    'Bitcoin',
    'Withdraw to your Bitcoin wallet. BTC network only. Network fees apply.',
    true
  ),
  (
    'eth',
    'Ethereum (ETH)',
    'crypto',
    0.00,
    0.002,
    'ETH',
    30.00,
    50000.00,
    '15-30 minutes',
    'Hexagon',
    'Withdraw to your Ethereum wallet. ERC-20 network. Gas fees may vary.',
    true
  ),
  (
    'usdc_erc20',
    'USDC (ERC-20)',
    'crypto',
    0.50,
    5.00,
    'USD',
    20.00,
    25000.00,
    '15-30 minutes',
    'DollarSign',
    'USDC on Ethereum network (ERC-20). Stablecoin pegged to USD.',
    true
  ),
  (
    'usdc_trc20',
    'USDC (TRC-20)',
    'crypto',
    0.50,
    2.00,
    'USD',
    20.00,
    25000.00,
    '10-20 minutes',
    'DollarSign',
    'USDC on Tron network (TRC-20). Lower fees than ERC-20.',
    false -- Disabled for now, can enable later
  )
ON CONFLICT (method_name) DO NOTHING;

-- ─── Triggers ─────────────────────────────────────────────────────────────────

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_withdrawal_methods_updated_at
  BEFORE UPDATE ON withdrawal_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── Helper Functions ─────────────────────────────────────────────────────────

-- Function to calculate withdrawal fee
CREATE OR REPLACE FUNCTION calculate_withdrawal_fee(
  p_amount DECIMAL,
  p_method_id UUID
)
RETURNS TABLE (
  fee_amount DECIMAL,
  net_amount DECIMAL,
  fee_percentage DECIMAL,
  fee_fixed DECIMAL
) AS $$
DECLARE
  v_method withdrawal_methods%ROWTYPE;
  v_fee DECIMAL;
BEGIN
  -- Get method details
  SELECT * INTO v_method FROM withdrawal_methods WHERE id = p_method_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal method not found';
  END IF;

  -- Calculate fee
  v_fee := (p_amount * v_method.fee_percentage / 100) + v_method.fee_fixed;

  -- Return calculated values
  RETURN QUERY SELECT
    v_fee,
    p_amount - v_fee,
    v_method.fee_percentage,
    v_method.fee_fixed;
END;
$$ LANGUAGE plpgsql;

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE withdrawal_methods IS 'Configuration for supported withdrawal payment methods with fees';
COMMENT ON TABLE withdrawal_requests IS 'User withdrawal requests with admin approval workflow';
COMMENT ON COLUMN withdrawal_requests.payment_details IS 'JSON containing method-specific payment information (encrypted in production)';
COMMENT ON COLUMN withdrawal_requests.net_amount IS 'Final amount user receives after fees';
COMMENT ON FUNCTION calculate_withdrawal_fee IS 'Calculates withdrawal fee based on amount and method';
