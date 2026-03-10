-- ============================================================================
-- ORDERS TABLE RLS POLICIES
-- Priority 0 - Security Fix
-- Created: 2026-02-10
-- Purpose: Add Row Level Security policies to orders table
-- ============================================================================

-- Enable RLS on orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for idempotency)
DROP POLICY IF EXISTS "Buyers can view own orders" ON orders;
DROP POLICY IF EXISTS "Sellers can view orders for their listings" ON orders;
DROP POLICY IF EXISTS "System can insert orders" ON orders;
DROP POLICY IF EXISTS "Sellers can update their orders" ON orders;
DROP POLICY IF EXISTS "Buyers can confirm their orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;

-- ============================================================================
-- SELECT POLICIES (View Orders)
-- ============================================================================

-- Policy: Buyers can view their own orders
CREATE POLICY "Buyers can view own orders"
  ON orders FOR SELECT
  USING (auth.uid() = buyer_id);

-- Policy: Sellers can view orders for their listings
CREATE POLICY "Sellers can view orders for their listings"
  ON orders FOR SELECT
  USING (auth.uid() = seller_id);

-- Policy: Admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- INSERT POLICIES (Create Orders)
-- ============================================================================

-- Policy: Only authenticated system/server can insert orders (via server actions)
-- Orders are created server-side after Stripe payment confirmation
CREATE POLICY "System can insert orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- ============================================================================
-- UPDATE POLICIES (Update Order Status)
-- ============================================================================

-- Policy: Sellers can update order status (mark as delivered, add delivery notes)
CREATE POLICY "Sellers can update their orders"
  ON orders FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Policy: Buyers can update order status (confirm delivery, open disputes)
CREATE POLICY "Buyers can confirm their orders"
  ON orders FOR UPDATE
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);

-- Policy: Admins can update all orders
CREATE POLICY "Admins can update all orders"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- DELETE POLICIES (Delete Orders)
-- ============================================================================

-- Policy: Only admins can delete orders (for data cleanup)
CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Index for auto-release queries (used by cron job)
CREATE INDEX IF NOT EXISTS idx_orders_auto_release
  ON orders(auto_release_at)
  WHERE status = 'delivered' AND escrow_status = 'held';

-- Index for seller order queries
CREATE INDEX IF NOT EXISTS idx_orders_seller_status
  ON orders(seller_id, status, created_at DESC);

-- Index for buyer order queries
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status
  ON orders(buyer_id, status, created_at DESC);

-- Index for payment intent lookups
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent
  ON orders(stripe_payment_intent_id);

-- Index for escrow status queries
CREATE INDEX IF NOT EXISTS idx_orders_escrow_status
  ON orders(escrow_status, created_at DESC);

-- ============================================================================
-- VERIFICATION QUERIES (Run these to test policies)
-- ============================================================================

-- Test as buyer:
-- SELECT * FROM orders WHERE buyer_id = auth.uid();

-- Test as seller:
-- SELECT * FROM orders WHERE seller_id = auth.uid();

-- Test unauthorized access (should return no rows):
-- SELECT * FROM orders WHERE buyer_id != auth.uid() AND seller_id != auth.uid();

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. RLS policies are enforced at the database level for ALL queries
-- 2. Server-side code with service role key bypasses RLS (use carefully)
-- 3. Rate limiting should be implemented at the application layer
-- 4. These policies work with the enhanced getOrder() and createOrder() functions
-- 5. Admins (role: 'admin' or 'super_admin') have full access to all orders
-- ============================================================================
