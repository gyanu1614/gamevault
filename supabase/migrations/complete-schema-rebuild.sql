-- =====================================================
-- GAMEVAULT COMPLETE DATABASE SCHEMA
-- Combines original schema + seller dashboard features
-- Date: January 25, 2026
-- This is a complete rebuild - run this fresh
-- =====================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CLEAN SLATE: Drop everything in correct order
-- =====================================================

-- Note: DROP TABLE ... CASCADE will automatically drop all policies, triggers, and constraints
-- So we don't need to drop policies manually

-- Drop views first
DROP VIEW IF EXISTS seller_dashboard_stats;

-- Drop tables in dependency order
DROP TABLE IF EXISTS public.seller_payouts CASCADE;
DROP TABLE IF EXISTS public.seller_notifications CASCADE;
DROP TABLE IF EXISTS public.seller_stats CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.listings CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.games CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop functions (will also drop associated triggers via CASCADE)
DROP FUNCTION IF EXISTS increment_listing_views(uuid);
DROP FUNCTION IF EXISTS set_order_number_if_null() CASCADE;
DROP FUNCTION IF EXISTS generate_order_number();
DROP FUNCTION IF EXISTS update_conversation_last_message() CASCADE;
DROP FUNCTION IF EXISTS update_listing_quantity() CASCADE;
DROP FUNCTION IF EXISTS update_seller_rating() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================

CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  bio text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Seller information (NULL by default - users must explicitly register as sellers)
  seller_tier text CHECK (seller_tier IS NULL OR seller_tier IN ('bronze', 'silver', 'gold', 'platinum')),
  total_sales integer DEFAULT 0,
  seller_rating numeric(3, 2) DEFAULT 0.00 CHECK (seller_rating >= 0 AND seller_rating <= 5),
  total_reviews integer DEFAULT 0,

  -- Seller fields for dashboard
  business_name text,
  paypal_email text,

  -- KYC status (only for sellers)
  kyc_status text CHECK (kyc_status IS NULL OR kyc_status IN ('pending', 'approved', 'rejected')),
  kyc_submitted_at timestamptz,

  -- Seller payout info
  stripe_account_id text,
  payout_enabled boolean DEFAULT false,

  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
  CONSTRAINT paypal_email_format CHECK (
    paypal_email IS NULL OR paypal_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'
  )
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- 2. GAMES TABLE
-- =====================================================

CREATE TABLE public.games (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  emoji text,
  image_url text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games are viewable by everyone"
  ON games FOR SELECT USING (is_active = true OR auth.role() = 'service_role');

-- Insert default games
INSERT INTO public.games (name, slug, emoji, image_url, is_active) VALUES
  ('Roblox', 'roblox', '🎮', '/games/roblox.png', true),
  ('Fortnite', 'fortnite', '⚔️', '/games/fortnite.png', true),
  ('Valorant', 'valorant', '🔫', '/games/valorant.png', true),
  ('GTA V', 'gta-v', '🚗', '/games/gta-v.png', true),
  ('Minecraft', 'minecraft', '⛏️', '/games/minecraft.png', true),
  ('League of Legends', 'lol', '⚡', '/games/lol.png', true);

-- =====================================================
-- 3. CATEGORIES TABLE
-- =====================================================

CREATE TABLE public.categories (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  icon text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by everyone"
  ON categories FOR SELECT USING (true);

-- Insert default categories
INSERT INTO public.categories (name, slug, icon) VALUES
  ('Accounts', 'accounts', '👤'),
  ('Currency', 'currency', '💰'),
  ('Items', 'items', '🎒'),
  ('Boosting', 'boosting', '🚀'),
  ('Coaching', 'coaching', '🎓');

-- =====================================================
-- 4. LISTINGS TABLE
-- =====================================================

CREATE TABLE public.listings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  game_id uuid REFERENCES public.games(id) NOT NULL,
  category_id uuid REFERENCES public.categories(id) NOT NULL,

  -- Listing details
  title text NOT NULL,
  description text NOT NULL,
  price numeric(10, 2) NOT NULL CHECK (price > 0),
  currency text DEFAULT 'USD' NOT NULL,
  original_price numeric(10, 2),

  -- Inventory
  quantity integer DEFAULT 1 CHECK (quantity >= 0),
  is_unlimited boolean DEFAULT false,

  -- Status (including 'paused' for seller dashboard)
  status text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'sold', 'archived', 'suspended', 'paused')),

  -- Images
  images text[] DEFAULT '{}',

  -- Delivery
  delivery_time text DEFAULT '1-24 hours',
  delivery_method text DEFAULT 'manual',

  -- Stats
  views integer DEFAULT 0,
  sales integer DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT title_length CHECK (char_length(title) >= 10 AND char_length(title) <= 100)
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active listings are viewable by everyone"
  ON listings FOR SELECT USING (status = 'active' OR seller_id = auth.uid());

CREATE POLICY "Sellers can create listings"
  ON listings FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own listings"
  ON listings FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete own listings"
  ON listings FOR DELETE USING (auth.uid() = seller_id);

-- Indexes
CREATE INDEX listings_game_id_idx ON public.listings(game_id);
CREATE INDEX listings_category_id_idx ON public.listings(category_id);
CREATE INDEX listings_seller_id_idx ON public.listings(seller_id);
CREATE INDEX listings_status_idx ON public.listings(status);
CREATE INDEX listings_created_at_idx ON public.listings(created_at DESC);

-- =====================================================
-- 5. ORDERS TABLE
-- =====================================================

CREATE TABLE public.orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_number text UNIQUE,

  -- Parties
  buyer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  listing_id uuid REFERENCES public.listings(id) NOT NULL,

  -- Order details
  quantity integer DEFAULT 1 NOT NULL CHECK (quantity > 0),
  unit_price numeric(10, 2) NOT NULL CHECK (unit_price > 0),
  subtotal numeric(10, 2) NOT NULL CHECK (subtotal > 0),

  -- Fees (in percentage)
  platform_fee_rate numeric(5, 2) NOT NULL CHECK (platform_fee_rate >= 0),
  payment_processing_fee_rate numeric(5, 2) NOT NULL CHECK (payment_processing_fee_rate >= 0),

  -- Calculated amounts
  platform_fee numeric(10, 2) NOT NULL,
  payment_processing_fee numeric(10, 2) NOT NULL,
  total_amount numeric(10, 2) NOT NULL CHECK (total_amount > 0),
  seller_payout numeric(10, 2) NOT NULL,

  -- Payment info
  stripe_payment_intent_id text UNIQUE,
  stripe_transfer_id text,

  -- Status
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'paid', 'processing', 'completed', 'disputed', 'refunded', 'cancelled'
  )),

  -- Protection period
  protection_until timestamptz,

  -- Delivery info
  delivery_details jsonb,
  delivered_at timestamptz,

  -- Dispute
  dispute_reason text,
  disputed_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers and sellers can view their orders"
  ON orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can create orders"
  ON orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers and sellers can update their orders"
  ON orders FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Indexes
CREATE INDEX orders_buyer_id_idx ON public.orders(buyer_id);
CREATE INDEX orders_seller_id_idx ON public.orders(seller_id);
CREATE INDEX orders_listing_id_idx ON public.orders(listing_id);
CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_created_at_idx ON public.orders(created_at DESC);

-- =====================================================
-- 6. CONVERSATIONS TABLE
-- =====================================================

CREATE TABLE public.conversations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  last_message_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(order_id)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversations"
  ON conversations FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- =====================================================
-- 7. MESSAGES TABLE
-- =====================================================

CREATE TABLE public.messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  attachments text[] DEFAULT '{}',
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT content_not_empty CHECK (char_length(trim(content)) > 0)
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation participants can view messages"
  ON messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.buyer_id = auth.uid() OR conversations.seller_id = auth.uid())
    )
  );

CREATE POLICY "Conversation participants can send messages"
  ON messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.buyer_id = auth.uid() OR conversations.seller_id = auth.uid())
    )
  );

-- Indexes
CREATE INDEX messages_conversation_id_idx ON public.messages(conversation_id);
CREATE INDEX messages_sender_id_idx ON public.messages(sender_id);
CREATE INDEX messages_created_at_idx ON public.messages(created_at DESC);

-- =====================================================
-- 8. REVIEWS TABLE
-- =====================================================

CREATE TABLE public.reviews (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reviewed_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text CHECK (char_length(comment) <= 1000),
  review_type text NOT NULL CHECK (review_type IN ('buyer_to_seller', 'seller_to_buyer')),

  -- Seller response fields
  seller_response text,
  seller_responded_at timestamptz,
  helpful_count integer DEFAULT 0,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(order_id, reviewer_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are viewable by everyone"
  ON reviews FOR SELECT USING (true);

CREATE POLICY "Users can create reviews for completed orders"
  ON reviews FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_id
      AND orders.status = 'completed'
      AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );

-- Indexes
CREATE INDEX reviews_reviewed_user_id_idx ON public.reviews(reviewed_user_id);
CREATE INDEX reviews_order_id_idx ON public.reviews(order_id);
CREATE INDEX reviews_created_at_idx ON public.reviews(created_at DESC);

-- =====================================================
-- 9. SELLER STATS TABLE (NEW)
-- =====================================================

CREATE TABLE public.seller_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

ALTER TABLE public.seller_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their stats" ON public.seller_stats
  FOR SELECT USING (auth.uid() = seller_id);

CREATE INDEX seller_stats_seller_id_idx ON public.seller_stats(seller_id);
CREATE INDEX seller_stats_date_idx ON public.seller_stats(date DESC);

-- =====================================================
-- 10. SELLER NOTIFICATIONS TABLE (NEW)
-- =====================================================

CREATE TABLE public.seller_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  related_id uuid,
  related_type text,
  read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.seller_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their notifications" ON public.seller_notifications
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their notifications" ON public.seller_notifications
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE INDEX seller_notifications_seller_id_idx ON public.seller_notifications(seller_id);
CREATE INDEX seller_notifications_read_idx ON public.seller_notifications(read);
CREATE INDEX seller_notifications_created_at_idx ON public.seller_notifications(created_at DESC);

-- =====================================================
-- 11. SELLER PAYOUTS TABLE (NEW)
-- =====================================================

CREATE TABLE public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their payouts" ON public.seller_payouts
  FOR SELECT USING (auth.uid() = seller_id);

CREATE INDEX seller_payouts_seller_id_idx ON public.seller_payouts(seller_id);
CREATE INDEX seller_payouts_status_idx ON public.seller_payouts(status);
CREATE INDEX seller_payouts_created_at_idx ON public.seller_payouts(created_at DESC);

-- =====================================================
-- 12. FUNCTIONS
-- =====================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
BEGIN
    RETURN 'GV-' || LPAD(floor(random() * 1000000)::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Set order number if null
CREATE OR REPLACE FUNCTION set_order_number_if_null()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update seller rating
CREATE OR REPLACE FUNCTION update_seller_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.review_type = 'buyer_to_seller' THEN
    UPDATE public.profiles
    SET
      seller_rating = (
        SELECT AVG(rating)
        FROM public.reviews
        WHERE reviewed_user_id = NEW.reviewed_user_id
        AND review_type = 'buyer_to_seller'
      ),
      total_reviews = (
        SELECT COUNT(*)
        FROM public.reviews
        WHERE reviewed_user_id = NEW.reviewed_user_id
        AND review_type = 'buyer_to_seller'
      )
    WHERE id = NEW.reviewed_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update listing quantity
CREATE OR REPLACE FUNCTION update_listing_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.listings
    SET
      quantity = CASE
        WHEN is_unlimited THEN quantity
        ELSE GREATEST(0, quantity - NEW.quantity)
      END,
      sales = sales + 1,
      status = CASE
        WHEN NOT is_unlimited AND quantity - NEW.quantity <= 0 THEN 'sold'
        ELSE status
      END
    WHERE id = NEW.listing_id;

    UPDATE public.profiles
    SET total_sales = total_sales + 1
    WHERE id = NEW.seller_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update conversation last message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment listing views
CREATE OR REPLACE FUNCTION increment_listing_views(listing_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.listings
  SET views = views + 1
  WHERE id = listing_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 13. TRIGGERS
-- =====================================================

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_review_created
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_seller_rating();

CREATE TRIGGER on_order_completed
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_listing_quantity();

CREATE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

CREATE TRIGGER set_order_number_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION set_order_number_if_null();

-- =====================================================
-- 14. DASHBOARD VIEW (NEW)
-- =====================================================

CREATE VIEW seller_dashboard_stats AS
SELECT
  p.id as seller_id,
  p.username,
  p.seller_tier,
  p.total_sales,
  p.seller_rating,

  (SELECT COUNT(*) FROM listings WHERE seller_id = p.id AND status = 'active') as active_listings,
  (SELECT COUNT(*) FROM listings WHERE seller_id = p.id AND status = 'paused') as paused_listings,
  (SELECT COUNT(*) FROM listings WHERE seller_id = p.id AND status = 'draft') as draft_listings,
  (SELECT COUNT(*) FROM listings WHERE seller_id = p.id AND status = 'sold') as sold_listings,

  (SELECT COUNT(*) FROM orders WHERE seller_id = p.id AND status = 'pending') as pending_orders,
  (SELECT COUNT(*) FROM orders WHERE seller_id = p.id AND status = 'processing') as processing_orders,
  (SELECT COUNT(*) FROM orders WHERE seller_id = p.id AND status = 'completed') as completed_orders,
  (SELECT COUNT(*) FROM orders WHERE seller_id = p.id AND status = 'disputed') as disputed_orders,

  (SELECT COALESCE(SUM(views), 0) FROM listings WHERE seller_id = p.id) as total_views,
  (SELECT COALESCE(SUM(sales), 0) FROM listings WHERE seller_id = p.id) as total_listing_sales,

  (SELECT COALESCE(SUM(seller_payout), 0)
   FROM orders
   WHERE seller_id = p.id AND status = 'completed'
   AND DATE(created_at) = CURRENT_DATE) as earnings_today,

  (SELECT COALESCE(SUM(seller_payout), 0)
   FROM orders
   WHERE seller_id = p.id AND status = 'completed'
   AND created_at >= CURRENT_DATE - INTERVAL '7 days') as earnings_week,

  (SELECT COALESCE(SUM(seller_payout), 0)
   FROM orders
   WHERE seller_id = p.id AND status = 'completed'
   AND created_at >= CURRENT_DATE - INTERVAL '30 days') as earnings_month,

  (SELECT COALESCE(SUM(seller_payout), 0)
   FROM orders
   WHERE seller_id = p.id AND status = 'completed') as earnings_all_time

FROM profiles p
WHERE p.seller_tier IS NOT NULL;

GRANT SELECT ON seller_dashboard_stats TO authenticated;

-- =====================================================
-- 15. COMMENTS
-- =====================================================

COMMENT ON TABLE public.profiles IS 'User profiles with seller capabilities';
COMMENT ON TABLE public.games IS 'Available games for marketplace';
COMMENT ON TABLE public.categories IS 'Listing categories';
COMMENT ON TABLE public.listings IS 'Seller product listings';
COMMENT ON TABLE public.orders IS 'Marketplace orders';
COMMENT ON TABLE public.conversations IS 'Order-based conversations';
COMMENT ON TABLE public.messages IS 'Messages within conversations';
COMMENT ON TABLE public.reviews IS 'Order reviews';
COMMENT ON TABLE public.seller_stats IS 'Daily seller analytics';
COMMENT ON TABLE public.seller_notifications IS 'Seller notifications';
COMMENT ON TABLE public.seller_payouts IS 'Seller payout history';
COMMENT ON VIEW seller_dashboard_stats IS 'Aggregated seller dashboard statistics';

-- =====================================================
-- 16. VERIFICATION
-- =====================================================

SELECT
  table_name,
  (SELECT COUNT(*)
   FROM information_schema.columns
   WHERE table_name = t.table_name
   AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN (
  'profiles', 'games', 'categories', 'listings', 'orders',
  'conversations', 'messages', 'reviews',
  'seller_stats', 'seller_notifications', 'seller_payouts'
)
ORDER BY table_name;

-- =====================================================
-- COMPLETE ✅
-- =====================================================
