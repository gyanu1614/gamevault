-- =====================================================
-- ADD SELLER DASHBOARD FEATURES
-- Compatible with existing GameVault schema
-- Date: January 25, 2026
-- =====================================================

-- This migration ADDS new tables without breaking existing ones
-- It works with your existing listings, orders, reviews, and profiles tables

-- =====================================================
-- 1. ADD MISSING COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add seller dashboard columns to listings (if they don't exist)
DO $$
BEGIN
  -- Add paused status if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listings_status_check'
  ) THEN
    ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
    ALTER TABLE public.listings ADD CONSTRAINT listings_status_check
      CHECK (status IN ('draft', 'active', 'sold', 'archived', 'suspended', 'paused'));
  END IF;
END $$;

-- Add original_price for discounts
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS original_price numeric(10, 2);

-- Add order_number to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_number text UNIQUE;

-- Add response fields to reviews for seller responses
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS seller_response text,
ADD COLUMN IF NOT EXISTS seller_responded_at timestamptz,
ADD COLUMN IF NOT EXISTS helpful_count integer DEFAULT 0;

-- =====================================================
-- 2. CREATE NEW TABLES FOR SELLER FEATURES
-- =====================================================

-- Seller Stats (Daily Analytics)
CREATE TABLE IF NOT EXISTS public.seller_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Daily stats snapshot
  date date NOT NULL,

  -- Revenue
  revenue numeric(10, 2) DEFAULT 0,
  orders_count integer DEFAULT 0,

  -- Traffic
  views integer DEFAULT 0,
  unique_visitors integer DEFAULT 0,

  -- Conversion
  conversion_rate numeric(5, 2) DEFAULT 0,

  -- Traffic Sources
  traffic_direct integer DEFAULT 0,
  traffic_search integer DEFAULT 0,
  traffic_social integer DEFAULT 0,
  traffic_external integer DEFAULT 0,

  -- Sales by Game (JSONB)
  sales_by_game jsonb DEFAULT '{}',

  created_at timestamptz DEFAULT now(),

  -- One record per seller per day
  UNIQUE(seller_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS seller_stats_seller_id_idx ON public.seller_stats(seller_id);
CREATE INDEX IF NOT EXISTS seller_stats_date_idx ON public.seller_stats(date DESC);

-- Enable RLS
ALTER TABLE public.seller_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY IF NOT EXISTS "Sellers can view their stats" ON public.seller_stats
  FOR SELECT USING (auth.uid() = seller_id);

-- Seller Notifications
CREATE TABLE IF NOT EXISTS public.seller_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification Details
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,

  -- Related Entity
  related_id uuid,
  related_type text,

  -- Status
  read boolean DEFAULT false,
  read_at timestamptz,

  -- Metadata
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS seller_notifications_seller_id_idx ON public.seller_notifications(seller_id);
CREATE INDEX IF NOT EXISTS seller_notifications_read_idx ON public.seller_notifications(read);
CREATE INDEX IF NOT EXISTS seller_notifications_created_at_idx ON public.seller_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.seller_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY IF NOT EXISTS "Sellers can view their notifications" ON public.seller_notifications
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY IF NOT EXISTS "Sellers can update their notifications" ON public.seller_notifications
  FOR UPDATE USING (auth.uid() = seller_id);

-- Seller Payouts
CREATE TABLE IF NOT EXISTS public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Payout Details
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'paypal',
  destination text NOT NULL,

  -- Status
  status text NOT NULL DEFAULT 'pending',

  -- Metadata
  processed_at timestamptz,
  completed_at timestamptz,
  failed_reason text,

  created_at timestamptz DEFAULT now(),

  CONSTRAINT valid_payout_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS seller_payouts_seller_id_idx ON public.seller_payouts(seller_id);
CREATE INDEX IF NOT EXISTS seller_payouts_status_idx ON public.seller_payouts(status);
CREATE INDEX IF NOT EXISTS seller_payouts_created_at_idx ON public.seller_payouts(created_at DESC);

-- Enable RLS
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY IF NOT EXISTS "Sellers can view their payouts" ON public.seller_payouts
  FOR SELECT USING (auth.uid() = seller_id);

-- =====================================================
-- 3. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to generate order numbers (if not exists)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
BEGIN
    RETURN 'GV-' || LPAD(floor(random() * 1000000)::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to set order number on insert
CREATE OR REPLACE FUNCTION set_order_number_if_null()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order numbers (if not exists)
DROP TRIGGER IF EXISTS set_order_number_trigger ON public.orders;
CREATE TRIGGER set_order_number_trigger
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION set_order_number_if_null();

-- Update existing orders without order numbers
UPDATE public.orders
SET order_number = generate_order_number()
WHERE order_number IS NULL;

-- Function to increment listing views
CREATE OR REPLACE FUNCTION increment_listing_views(listing_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.listings
  SET views = views + 1
  WHERE id = listing_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. CREATE VIEWS FOR EASIER QUERYING
-- =====================================================

-- View: Seller dashboard stats
CREATE OR REPLACE VIEW seller_dashboard_stats AS
SELECT
  p.id as seller_id,
  p.username,
  p.seller_tier,
  p.total_sales,
  p.seller_rating,

  -- Count active listings
  (SELECT COUNT(*) FROM listings WHERE seller_id = p.id AND status = 'active') as active_listings,
  (SELECT COUNT(*) FROM listings WHERE seller_id = p.id AND status = 'paused') as paused_listings,
  (SELECT COUNT(*) FROM listings WHERE seller_id = p.id AND status = 'draft') as draft_listings,
  (SELECT COUNT(*) FROM listings WHERE seller_id = p.id AND status = 'sold') as sold_listings,

  -- Count orders by status
  (SELECT COUNT(*) FROM orders WHERE seller_id = p.id AND status = 'pending') as pending_orders,
  (SELECT COUNT(*) FROM orders WHERE seller_id = p.id AND status = 'processing') as processing_orders,
  (SELECT COUNT(*) FROM orders WHERE seller_id = p.id AND status = 'completed') as completed_orders,
  (SELECT COUNT(*) FROM orders WHERE seller_id = p.id AND status = 'disputed') as disputed_orders,

  -- Total views and sales
  (SELECT COALESCE(SUM(views), 0) FROM listings WHERE seller_id = p.id) as total_views,
  (SELECT COALESCE(SUM(sales), 0) FROM listings WHERE seller_id = p.id) as total_listing_sales,

  -- Revenue calculations (using seller_payout from orders)
  (SELECT COALESCE(SUM(seller_payout), 0)
   FROM orders
   WHERE seller_id = p.id
   AND status = 'completed'
   AND DATE(created_at) = CURRENT_DATE) as earnings_today,

  (SELECT COALESCE(SUM(seller_payout), 0)
   FROM orders
   WHERE seller_id = p.id
   AND status = 'completed'
   AND created_at >= CURRENT_DATE - INTERVAL '7 days') as earnings_week,

  (SELECT COALESCE(SUM(seller_payout), 0)
   FROM orders
   WHERE seller_id = p.id
   AND status = 'completed'
   AND created_at >= CURRENT_DATE - INTERVAL '30 days') as earnings_month,

  (SELECT COALESCE(SUM(seller_payout), 0)
   FROM orders
   WHERE seller_id = p.id
   AND status = 'completed') as earnings_all_time

FROM profiles p
WHERE p.seller_tier IS NOT NULL;

-- Grant access to view
GRANT SELECT ON seller_dashboard_stats TO authenticated;

-- =====================================================
-- 5. COMMENTS
-- =====================================================

COMMENT ON TABLE public.seller_stats IS 'Daily analytics snapshots for sellers';
COMMENT ON TABLE public.seller_notifications IS 'Real-time notifications for sellers';
COMMENT ON TABLE public.seller_payouts IS 'Seller payout/withdrawal history';
COMMENT ON VIEW seller_dashboard_stats IS 'Aggregated seller dashboard statistics';

-- =====================================================
-- 6. VERIFY MIGRATION
-- =====================================================

-- Show all seller-related tables
SELECT
  table_name,
  (SELECT COUNT(*)
   FROM information_schema.columns
   WHERE table_name = t.table_name
   AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND (
  table_name LIKE 'seller_%'
  OR table_name IN ('listings', 'orders', 'reviews', 'profiles')
)
ORDER BY table_name;

-- =====================================================
-- MIGRATION COMPLETE ✅
-- =====================================================
