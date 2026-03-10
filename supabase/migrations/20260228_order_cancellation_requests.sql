-- ============================================================================
-- Order Cancellation Requests Migration
-- Created: 2026-02-28
-- Purpose: Allow buyers to request order cancellations (admin approval required)
-- ============================================================================

-- Create order_cancellation_requests table
CREATE TABLE IF NOT EXISTS order_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  admin_id UUID REFERENCES profiles(id), -- Who processed it
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(order_id) -- One request per order
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cancel_requests_status ON order_cancellation_requests(status);
CREATE INDEX IF NOT EXISTS idx_cancel_requests_buyer ON order_cancellation_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_cancel_requests_order ON order_cancellation_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_cancel_requests_created_at ON order_cancellation_requests(created_at DESC);

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
      AND orders.status IN ('delivered', 'processing')
    )
  );

-- Admins can view all requests
CREATE POLICY "Admins can view all cancellation requests"
  ON order_cancellation_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update cancellation requests"
  ON order_cancellation_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
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

-- Add comment
COMMENT ON TABLE order_cancellation_requests IS 'Stores buyer cancellation requests that require admin approval for orders with delivery time >= 6 hours';
COMMENT ON COLUMN order_cancellation_requests.status IS 'Request status: pending (awaiting admin review), approved (admin accepted, order cancelled), rejected (admin denied)';
COMMENT ON COLUMN order_cancellation_requests.reason IS 'Buyer''s reason for requesting cancellation';
COMMENT ON COLUMN order_cancellation_requests.admin_notes IS 'Optional notes from admin explaining approval/rejection decision';
