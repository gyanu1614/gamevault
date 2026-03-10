-- =====================================================
-- SAFE SELLER SCHEMA MIGRATION
-- Drops existing tables and recreates them
-- Date: January 25, 2026
-- =====================================================

-- Drop existing tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS public.seller_payouts CASCADE;
DROP TABLE IF EXISTS public.seller_notifications CASCADE;
DROP TABLE IF EXISTS public.seller_tier_progress CASCADE;
DROP TABLE IF EXISTS public.seller_stats CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.listings CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS generate_order_number() CASCADE;
DROP FUNCTION IF EXISTS set_order_number() CASCADE;
DROP FUNCTION IF EXISTS calculate_seller_tier(integer) CASCADE;
DROP FUNCTION IF EXISTS update_seller_tier_progress_on_order() CASCADE;
DROP FUNCTION IF EXISTS increment_listing_views(uuid) CASCADE;

-- =====================================================
-- 1. CREATE FUNCTIONS FIRST
-- =====================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Generate unique order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
BEGIN
    RETURN 'GV-' || LPAD(floor(random() * 1000000)::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Calculate seller tier based on sales
CREATE OR REPLACE FUNCTION calculate_seller_tier(total_sales integer)
RETURNS text AS $$
BEGIN
  IF total_sales >= 1000 THEN RETURN 'diamond';
  ELSIF total_sales >= 500 THEN RETURN 'platinum';
  ELSIF total_sales >= 250 THEN RETURN 'gold';
  ELSIF total_sales >= 100 THEN RETURN 'silver';
  ELSE RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. LISTINGS TABLE
-- =====================================================
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Game & Category
  game text NOT NULL,
  category text NOT NULL,

  -- Listing Details
  title text NOT NULL,
  description text NOT NULL,
  price decimal(10, 2) NOT NULL CHECK (price >= 0),
  original_price decimal(10, 2),

  -- Inventory
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unlimited_stock boolean DEFAULT false,

  -- Delivery
  delivery_method text NOT NULL DEFAULT 'manual',
  delivery_time text,

  -- Images (array of URLs)
  images text[] DEFAULT '{}',

  -- Status
  status text NOT NULL DEFAULT 'draft',

  -- Stats
  views integer DEFAULT 0,
  sales integer DEFAULT 0,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT valid_game CHECK (game IN ('valorant', 'league-of-legends', 'csgo', 'genshin-impact', 'rocket-league', 'fortnite')),
  CONSTRAINT valid_category CHECK (category IN ('accounts', 'skins', 'boosting', 'coaching', 'in-game-items')),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'paused', 'sold')),
  CONSTRAINT valid_delivery CHECK (delivery_method IN ('instant', 'manual'))
);

-- Indexes
CREATE INDEX listings_seller_id_idx ON public.listings(seller_id);
CREATE INDEX listings_game_idx ON public.listings(game);
CREATE INDEX listings_category_idx ON public.listings(category);
CREATE INDEX listings_status_idx ON public.listings(status);
CREATE INDEX listings_created_at_idx ON public.listings(created_at DESC);
CREATE INDEX listings_price_idx ON public.listings(price);

-- Trigger
CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON public.listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. ORDERS TABLE
-- =====================================================
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL DEFAULT generate_order_number(),

  -- Relationships
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Order Details
  amount decimal(10, 2) NOT NULL CHECK (amount >= 0),
  platform_fee decimal(10, 2) NOT NULL DEFAULT 0,
  payment_processing_fee decimal(10, 2) NOT NULL DEFAULT 0,
  seller_earnings decimal(10, 2) NOT NULL CHECK (seller_earnings >= 0),

  -- Status
  status text NOT NULL DEFAULT 'pending',

  -- Delivery
  delivery_details jsonb,
  delivered_at timestamptz,

  -- Dispute
  dispute_reason text,
  dispute_details text,
  disputed_at timestamptz,
  resolved_at timestamptz,

  -- Messages
  has_unread_messages boolean DEFAULT false,
  last_message_at timestamptz,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT valid_order_status CHECK (status IN ('pending', 'processing', 'completed', 'disputed', 'cancelled', 'refunded'))
);

-- Indexes
CREATE INDEX orders_seller_id_idx ON public.orders(seller_id);
CREATE INDEX orders_buyer_id_idx ON public.orders(buyer_id);
CREATE INDEX orders_listing_id_idx ON public.orders(listing_id);
CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_created_at_idx ON public.orders(created_at DESC);
CREATE INDEX orders_order_number_idx ON public.orders(order_number);

-- Trigger
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. REVIEWS TABLE
-- =====================================================
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Review Content
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,

  -- Seller Response
  response text,
  responded_at timestamptz,

  -- Engagement
  helpful_count integer DEFAULT 0,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure one review per order
  UNIQUE(order_id)
);

-- Indexes
CREATE INDEX reviews_seller_id_idx ON public.reviews(seller_id);
CREATE INDEX reviews_buyer_id_idx ON public.reviews(buyer_id);
CREATE INDEX reviews_listing_id_idx ON public.reviews(listing_id);
CREATE INDEX reviews_rating_idx ON public.reviews(rating);
CREATE INDEX reviews_created_at_idx ON public.reviews(created_at DESC);

-- Trigger
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. SELLER STATS TABLE
-- =====================================================
CREATE TABLE public.seller_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Daily stats snapshot
  date date NOT NULL,

  -- Revenue
  revenue decimal(10, 2) DEFAULT 0,
  orders_count integer DEFAULT 0,

  -- Traffic
  views integer DEFAULT 0,
  unique_visitors integer DEFAULT 0,

  -- Conversion
  conversion_rate decimal(5, 2) DEFAULT 0,

  -- Traffic Sources
  traffic_direct integer DEFAULT 0,
  traffic_search integer DEFAULT 0,
  traffic_social integer DEFAULT 0,
  traffic_external integer DEFAULT 0,

  -- Sales by Game
  sales_by_game jsonb DEFAULT '{}',

  created_at timestamptz DEFAULT now(),

  -- One record per seller per day
  UNIQUE(seller_id, date)
);

-- Indexes
CREATE INDEX seller_stats_seller_id_idx ON public.seller_stats(seller_id);
CREATE INDEX seller_stats_date_idx ON public.seller_stats(date DESC);

-- =====================================================
-- 6. SELLER TIER PROGRESS TABLE
-- =====================================================
CREATE TABLE public.seller_tier_progress (
  seller_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Current Tier
  current_tier text NOT NULL DEFAULT 'bronze',

  -- Progress
  total_sales integer DEFAULT 0,
  total_revenue decimal(10, 2) DEFAULT 0,
  avg_rating decimal(3, 2) DEFAULT 0,
  response_rate integer DEFAULT 0,

  -- Next tier requirements
  sales_needed_for_next_tier integer,

  updated_at timestamptz DEFAULT now(),

  CONSTRAINT valid_tier CHECK (current_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond'))
);

-- Trigger
CREATE TRIGGER update_seller_tier_progress_updated_at BEFORE UPDATE ON public.seller_tier_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. SELLER NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE public.seller_notifications (
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
CREATE INDEX seller_notifications_seller_id_idx ON public.seller_notifications(seller_id);
CREATE INDEX seller_notifications_read_idx ON public.seller_notifications(read);
CREATE INDEX seller_notifications_created_at_idx ON public.seller_notifications(created_at DESC);

-- =====================================================
-- 8. SELLER PAYOUTS TABLE
-- =====================================================
CREATE TABLE public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Payout Details
  amount decimal(10, 2) NOT NULL CHECK (amount > 0),
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
CREATE INDEX seller_payouts_seller_id_idx ON public.seller_payouts(seller_id);
CREATE INDEX seller_payouts_status_idx ON public.seller_payouts(status);
CREATE INDEX seller_payouts_created_at_idx ON public.seller_payouts(created_at DESC);

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_tier_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

-- LISTINGS POLICIES
CREATE POLICY "Sellers can view their own listings" ON public.listings
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can create listings" ON public.listings
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own listings" ON public.listings
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own listings" ON public.listings
  FOR DELETE USING (auth.uid() = seller_id);

CREATE POLICY "Public can view active listings" ON public.listings
  FOR SELECT USING (status = 'active');

-- ORDERS POLICIES
CREATE POLICY "Sellers can view their orders" ON public.orders
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Buyers can view their orders" ON public.orders
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can update their orders" ON public.orders
  FOR UPDATE USING (auth.uid() = seller_id);

-- REVIEWS POLICIES
CREATE POLICY "Sellers can view their reviews" ON public.reviews
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Buyers can view their reviews" ON public.reviews
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Public can view all reviews" ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY "Sellers can respond to their reviews" ON public.reviews
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Buyers can create reviews for their orders" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- SELLER STATS POLICIES
CREATE POLICY "Sellers can view their stats" ON public.seller_stats
  FOR SELECT USING (auth.uid() = seller_id);

-- SELLER TIER PROGRESS POLICIES
CREATE POLICY "Sellers can view their tier progress" ON public.seller_tier_progress
  FOR SELECT USING (auth.uid() = seller_id);

-- SELLER NOTIFICATIONS POLICIES
CREATE POLICY "Sellers can view their notifications" ON public.seller_notifications
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their notifications" ON public.seller_notifications
  FOR UPDATE USING (auth.uid() = seller_id);

-- SELLER PAYOUTS POLICIES
CREATE POLICY "Sellers can view their payouts" ON public.seller_payouts
  FOR SELECT USING (auth.uid() = seller_id);

-- =====================================================
-- 10. ADDITIONAL FUNCTIONS
-- =====================================================

-- Function to increment listing views
CREATE OR REPLACE FUNCTION increment_listing_views(listing_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.listings
  SET views = views + 1
  WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update seller tier progress (called after order completion)
CREATE OR REPLACE FUNCTION update_seller_tier_progress_on_order()
RETURNS TRIGGER AS $$
DECLARE
  seller_total_sales integer;
  seller_total_revenue decimal;
  seller_avg_rating decimal;
  new_tier text;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Get seller totals
    SELECT COUNT(*), COALESCE(SUM(seller_earnings), 0)
    INTO seller_total_sales, seller_total_revenue
    FROM public.orders
    WHERE seller_id = NEW.seller_id AND status = 'completed';

    -- Get average rating
    SELECT COALESCE(AVG(rating), 0)
    INTO seller_avg_rating
    FROM public.reviews
    WHERE seller_id = NEW.seller_id;

    -- Calculate new tier
    new_tier := calculate_seller_tier(seller_total_sales);

    -- Update or insert tier progress
    INSERT INTO public.seller_tier_progress (
      seller_id,
      current_tier,
      total_sales,
      total_revenue,
      avg_rating
    ) VALUES (
      NEW.seller_id,
      new_tier,
      seller_total_sales,
      seller_total_revenue,
      seller_avg_rating
    )
    ON CONFLICT (seller_id) DO UPDATE SET
      current_tier = new_tier,
      total_sales = seller_total_sales,
      total_revenue = seller_total_revenue,
      avg_rating = seller_avg_rating,
      updated_at = now();

    -- Increment listing sales count
    UPDATE public.listings
    SET sales = sales + 1
    WHERE id = NEW.listing_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tier progression
CREATE TRIGGER update_seller_tier_on_order_complete
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION update_seller_tier_progress_on_order();

-- =====================================================
-- 11. COMMENTS
-- =====================================================
COMMENT ON TABLE public.listings IS 'Seller product listings (accounts, skins, services)';
COMMENT ON TABLE public.orders IS 'All marketplace orders with buyer-seller relationship';
COMMENT ON TABLE public.reviews IS 'Buyer reviews for completed orders';
COMMENT ON TABLE public.seller_stats IS 'Daily analytics snapshots for sellers';
COMMENT ON TABLE public.seller_tier_progress IS 'Seller tier system tracking (bronze to diamond)';
COMMENT ON TABLE public.seller_notifications IS 'Real-time notifications for sellers';
COMMENT ON TABLE public.seller_payouts IS 'Seller payout/withdrawal history';

-- =====================================================
-- SCHEMA DEPLOYMENT COMPLETE
-- =====================================================

-- Verify tables were created
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('listings', 'orders', 'reviews', 'seller_stats', 'seller_tier_progress', 'seller_notifications', 'seller_payouts')
ORDER BY table_name;
