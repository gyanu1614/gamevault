-- =====================================================
-- ADD SELLER DASHBOARD FEATURES (FIXED)
-- Compatible with existing GameVault schema
-- Date: January 25, 2026
-- =====================================================

-- =====================================================
-- 1. ADD MISSING COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add paused status if not exists
DO $$
BEGIN
  ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
  ALTER TABLE public.listings ADD CONSTRAINT listings_status_check
    CHECK (status IN ('draft', 'active', 'sold', 'archived', 'suspended', 'paused'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add original_price for discounts
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS original_price numeric(10, 2);

-- Add order_number to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_number text;

-- Make order_number unique
DO $$
BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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
  date date NOT NULL,
  revenue numeric(10, 2) DEFAULT 0,
  orders_count integer DEFAULT 0,
  views integer DEFAULT 0,
  unique_visitors integer DEFAULT 0,
  conversion_rate numeric(5, 2) DEFAULT 0,
  traffic_direct integer DEFAULT 0,
  traffic_search integer DEFAULT 0,
  traffic_social integer DEFAULT 0,
  traffic_external integer DEFAULT 0,
  sales_by_game jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(seller_id, date)
);

CREATE INDEX IF NOT EXISTS seller_stats_seller_id_idx ON public.seller_stats(seller_id);
CREATE INDEX IF NOT EXISTS seller_stats_date_idx ON public.seller_stats(date DESC);

-- Seller Notifications
CREATE TABLE IF NOT EXISTS public.seller_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  related_id uuid,
  related_type text,
  read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seller_notifications_seller_id_idx ON public.seller_notifications(seller_id);
CREATE INDEX IF NOT EXISTS seller_notifications_read_idx ON public.seller_notifications(read);
CREATE INDEX IF NOT EXISTS seller_notifications_created_at_idx ON public.seller_notifications(created_at DESC);

-- Seller Payouts
CREATE TABLE IF NOT EXISTS public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'paypal',
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  completed_at timestamptz,
  failed_reason text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_payout_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS seller_payouts_seller_id_idx ON public.seller_payouts(seller_id);
CREATE INDEX IF NOT EXISTS seller_payouts_status_idx ON public.seller_payouts(status);
CREATE INDEX IF NOT EXISTS seller_payouts_created_at_idx ON public.seller_payouts(created_at DESC);

-- =====================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.seller_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. DROP EXISTING POLICIES (to avoid conflicts)
-- =====================================================

DROP POLICY IF EXISTS "Sellers can view their stats" ON public.seller_stats;
DROP POLICY IF EXISTS "Sellers can view their notifications" ON public.seller_notifications;
DROP POLICY IF EXISTS "Sellers can update their notifications" ON public.seller_notifications;
DROP POLICY IF EXISTS "Sellers can view their payouts" ON public.seller_payouts;

-- =====================================================
-- 5. CREATE RLS POLICIES
-- =====================================================

CREATE POLICY "Sellers can view their stats" ON public.seller_stats
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can view their notifications" ON public.seller_notifications
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their notifications" ON public.seller_notifications
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can view their payouts" ON public.seller_payouts
  FOR SELECT USING (auth.uid() = seller_id);

-- =====================================================
-- 6. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to generate order numbers
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

-- Create trigger for order numbers
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
-- 7. CREATE VIEW FOR DASHBOARD STATS
-- =====================================================

DROP VIEW IF EXISTS seller_dashboard_stats;

CREATE VIEW seller_dashboard_stats AS
SELECT
  p.id as seller_id,
  p.username,
  p.seller_tier,
  p.total_sales,
  p.seller_rating,

  -- Count listings by status
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
-- 8. COMMENTS
-- =====================================================

COMMENT ON TABLE public.seller_stats IS 'Daily analytics snapshots for sellers';
COMMENT ON TABLE public.seller_notifications IS 'Real-time notifications for sellers';
COMMENT ON TABLE public.seller_payouts IS 'Seller payout/withdrawal history';
COMMENT ON VIEW seller_dashboard_stats IS 'Aggregated seller dashboard statistics';

-- =====================================================
-- 9. VERIFY MIGRATION
-- =====================================================

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
