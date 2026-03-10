-- =====================================================
-- Reviews & Rating System Migration (v2 - Fixed)
-- =====================================================
-- Drops and recreates the reviews table with new schema
-- =====================================================

-- Drop existing reviews table and related objects
DROP TABLE IF EXISTS reviews CASCADE;

-- Create reviews table with complete schema
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,

  -- Rating & Content
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  comment TEXT NOT NULL,

  -- Auto-calculated sentiment
  is_positive BOOLEAN GENERATED ALWAYS AS (rating >= 4) STORED,

  -- Seller Response
  seller_response TEXT,
  seller_responded_at TIMESTAMPTZ,

  -- Metadata
  is_verified_purchase BOOLEAN DEFAULT true,
  is_visible BOOLEAN DEFAULT true,
  flagged_for_moderation BOOLEAN DEFAULT false,
  moderation_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT review_title_length CHECK (char_length(title) <= 100),
  CONSTRAINT review_comment_length CHECK (char_length(comment) BETWEEN 10 AND 2000),
  CONSTRAINT seller_response_length CHECK (char_length(seller_response) <= 500)
);

-- Add seller rating fields to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='seller_rating') THEN
    ALTER TABLE profiles ADD COLUMN seller_rating DECIMAL(2,1) DEFAULT 0.0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='total_reviews') THEN
    ALTER TABLE profiles ADD COLUMN total_reviews INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='positive_reviews') THEN
    ALTER TABLE profiles ADD COLUMN positive_reviews INTEGER DEFAULT 0;
  END IF;
END $$;

-- =====================================================
-- INDEXES for Performance
-- =====================================================

-- Primary lookup indexes
CREATE INDEX idx_reviews_seller_id ON reviews(seller_id) WHERE is_visible = true;
CREATE INDEX idx_reviews_listing_id ON reviews(listing_id) WHERE is_visible = true;
CREATE INDEX idx_reviews_game_id ON reviews(game_id) WHERE is_visible = true;
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_order_id ON reviews(order_id);

-- Sorting indexes
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- Composite indexes for common queries
CREATE INDEX idx_reviews_seller_rating ON reviews(seller_id, rating, created_at DESC) WHERE is_visible = true;
CREATE INDEX idx_reviews_listing_rating ON reviews(listing_id, rating, created_at DESC) WHERE is_visible = true;

-- Moderation index
CREATE INDEX idx_reviews_flagged ON reviews(flagged_for_moderation, created_at DESC) WHERE flagged_for_moderation = true;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update seller rating when review is created/updated/deleted
CREATE OR REPLACE FUNCTION update_seller_rating()
RETURNS TRIGGER AS $$
DECLARE
  seller_uuid UUID;
  avg_rating DECIMAL(2,1);
  review_count INTEGER;
  positive_count INTEGER;
BEGIN
  -- Determine which seller_id to update
  IF TG_OP = 'DELETE' THEN
    seller_uuid := OLD.seller_id;
  ELSE
    seller_uuid := NEW.seller_id;
  END IF;

  -- Calculate new rating statistics
  SELECT
    COALESCE(ROUND(AVG(rating)::NUMERIC, 1), 0.0)::DECIMAL(2,1),
    COUNT(*),
    COUNT(*) FILTER (WHERE rating >= 4)
  INTO avg_rating, review_count, positive_count
  FROM reviews
  WHERE seller_id = seller_uuid
    AND is_visible = true;

  -- Update profiles table
  UPDATE profiles
  SET
    seller_rating = avg_rating,
    total_reviews = review_count,
    positive_reviews = positive_count,
    updated_at = now()
  WHERE id = seller_uuid;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to update review timestamp
CREATE OR REPLACE FUNCTION update_review_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update seller rating on review changes
CREATE TRIGGER trigger_update_seller_rating_on_insert
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_rating();

CREATE TRIGGER trigger_update_seller_rating_on_update
  AFTER UPDATE ON reviews
  FOR EACH ROW
  WHEN (OLD.rating IS DISTINCT FROM NEW.rating OR OLD.is_visible IS DISTINCT FROM NEW.is_visible)
  EXECUTE FUNCTION update_seller_rating();

CREATE TRIGGER trigger_update_seller_rating_on_delete
  AFTER DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_rating();

-- Auto-update timestamp on review modification
CREATE TRIGGER trigger_update_review_timestamp
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_review_timestamp();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view visible reviews
CREATE POLICY "Anyone can view visible reviews"
  ON reviews FOR SELECT
  USING (is_visible = true);

-- Policy: Buyers can create reviews for their completed orders
CREATE POLICY "Buyers can create reviews for completed orders"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id AND
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
        AND orders.buyer_id = auth.uid()
        AND orders.status = 'completed'
        AND NOT EXISTS (
          SELECT 1 FROM reviews WHERE reviews.order_id = orders.id
        )
    )
  );

-- Policy: Reviewers can update their own reviews (within 7 days)
CREATE POLICY "Reviewers can update own reviews"
  ON reviews FOR UPDATE
  USING (
    auth.uid() = reviewer_id AND
    created_at > now() - INTERVAL '7 days'
  )
  WITH CHECK (
    auth.uid() = reviewer_id
  );

-- Policy: Sellers can add responses to reviews
CREATE POLICY "Sellers can respond to reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (
    auth.uid() = seller_id AND
    seller_response IS NOT NULL
  );

-- Policy: Admins can moderate reviews
CREATE POLICY "Admins can moderate reviews"
  ON reviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE reviews IS 'Customer reviews for completed orders';
COMMENT ON COLUMN reviews.order_id IS 'One review per order - enforced by UNIQUE constraint';
COMMENT ON COLUMN reviews.is_positive IS 'Auto-calculated: true if rating >= 4';
COMMENT ON COLUMN reviews.is_verified_purchase IS 'Always true for order-based reviews';
COMMENT ON COLUMN reviews.flagged_for_moderation IS 'Admin moderation flag';

-- =====================================================
-- Migration Complete
-- =====================================================
