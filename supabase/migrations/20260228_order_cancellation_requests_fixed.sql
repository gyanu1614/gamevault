-- ============================================================================
-- Order Cancellation Requests Migration (Fixed - Idempotent)
-- Created: 2026-02-28
-- Updated: 2026-03-02
-- Purpose: Allow buyers to request order cancellations (admin approval required)
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Buyers can view own cancellation requests" ON order_cancellation_requests;
DROP POLICY IF EXISTS "Buyers can create cancellation requests" ON order_cancellation_requests;
DROP POLICY IF EXISTS "Admins can view all cancellation requests" ON order_cancellation_requests;
DROP POLICY IF EXISTS "Admins can update cancellation requests" ON order_cancellation_requests;
DROP POLICY IF EXISTS "Sellers can view cancellation requests for their orders" ON order_cancellation_requests;

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_cancel_requests_status;
DROP INDEX IF EXISTS idx_cancel_requests_buyer;
DROP INDEX IF EXISTS idx_cancel_requests_order;
DROP INDEX IF EXISTS idx_cancel_requests_created_at;

-- Create table if not exists
CREATE TABLE IF NOT EXISTS order_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  admin_id UUID REFERENCES profiles(id), -- Who processed it
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_cancellation_requests_order_id_key'
  ) THEN
    ALTER TABLE order_cancellation_requests
    ADD CONSTRAINT order_cancellation_requests_order_id_key UNIQUE(order_id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX idx_cancel_requests_status ON order_cancellation_requests(status);
CREATE INDEX idx_cancel_requests_buyer ON order_cancellation_requests(buyer_id);
CREATE INDEX idx_cancel_requests_order ON order_cancellation_requests(order_id);
CREATE INDEX idx_cancel_requests_created_at ON order_cancellation_requests(created_at DESC);

-- Enable RLS
ALTER TABLE order_cancellation_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Buyers can view their own requests
CREATE POLICY "Buyers can view own cancellation requests"
  ON order_cancellation_requests
  FOR SELECT
  USING (
    buyer_id = auth.uid()
  );

-- Buyers can create cancellation requests for their orders
CREATE POLICY "Buyers can create cancellation requests"
  ON order_cancellation_requests
  FOR INSERT
  WITH CHECK (
    buyer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
      AND orders.buyer_id = auth.uid()
      AND orders.status IN ('delivered', 'processing', 'paid')
    )
  );

-- Admins can view all requests
-- NOTE: Uses admin_roles table (NOT profiles.role) - see 20260128_secure_admin_roles.sql
CREATE POLICY "Admins can view all cancellation requests"
  ON order_cancellation_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.is_active = true
    )
  );

-- Admins can update requests (approve/reject)
-- NOTE: Uses admin_roles table (NOT profiles.role) - see 20260128_secure_admin_roles.sql
CREATE POLICY "Admins can update cancellation requests"
  ON order_cancellation_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.is_active = true
    )
  );

-- Sellers can view requests for their orders
CREATE POLICY "Sellers can view cancellation requests for their orders"
  ON order_cancellation_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN listings ON orders.listing_id = listings.id
      WHERE orders.id = order_id
      AND listings.seller_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE order_cancellation_requests IS 'Stores buyer cancellation requests that require admin approval for orders with delivery time >= 6 hours';
COMMENT ON COLUMN order_cancellation_requests.status IS 'Request status: pending (awaiting admin review), approved (admin accepted, order cancelled), rejected (admin denied)';
COMMENT ON COLUMN order_cancellation_requests.reason IS 'Buyer''s reason for requesting cancellation';
COMMENT ON COLUMN order_cancellation_requests.admin_notes IS 'Optional notes from admin explaining approval/rejection decision';
