-- Create shop_visits table for tracking shop analytics
-- This allows sellers to see who visited their shop and when

CREATE TABLE IF NOT EXISTS shop_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- NULL if not logged in
  visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  country_code VARCHAR(2),
  city VARCHAR(100),
  device_type VARCHAR(20) CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  page_path TEXT,
  session_id UUID, -- For tracking unique sessions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_shop_visits_seller_id ON shop_visits(seller_id);
CREATE INDEX IF NOT EXISTS idx_shop_visits_visitor_id ON shop_visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_shop_visits_visited_at ON shop_visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_visits_session_id ON shop_visits(session_id);
CREATE INDEX IF NOT EXISTS idx_shop_visits_seller_visited ON shop_visits(seller_id, visited_at DESC);

-- Create a view for shop analytics summary
CREATE OR REPLACE VIEW shop_analytics_summary AS
SELECT
  seller_id,
  COUNT(DISTINCT session_id) as total_unique_visits,
  COUNT(*) as total_page_views,
  COUNT(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) as unique_registered_visitors,
  COUNT(*) FILTER (WHERE visited_at >= NOW() - INTERVAL '24 hours') as visits_last_24h,
  COUNT(*) FILTER (WHERE visited_at >= NOW() - INTERVAL '7 days') as visits_last_7d,
  COUNT(*) FILTER (WHERE visited_at >= NOW() - INTERVAL '30 days') as visits_last_30d,
  COUNT(DISTINCT DATE(visited_at)) FILTER (WHERE visited_at >= NOW() - INTERVAL '30 days') as active_days_last_30d
FROM shop_visits
GROUP BY seller_id;

-- Add RLS (Row Level Security) policies
ALTER TABLE shop_visits ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own shop visits
CREATE POLICY "Sellers can view their own shop visits"
  ON shop_visits
  FOR SELECT
  USING (
    seller_id IN (
      SELECT id FROM profiles WHERE id = auth.uid()
    )
  );

-- Anyone can insert shop visits (for tracking)
CREATE POLICY "Anyone can insert shop visits"
  ON shop_visits
  FOR INSERT
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE shop_visits IS 'Tracks all visits to seller shop pages for analytics';
COMMENT ON COLUMN shop_visits.seller_id IS 'ID of the seller whose shop was visited';
COMMENT ON COLUMN shop_visits.visitor_id IS 'ID of the visitor (NULL if not logged in)';
COMMENT ON COLUMN shop_visits.session_id IS 'Unique session identifier for tracking unique visits';
COMMENT ON COLUMN shop_visits.device_type IS 'Type of device used to visit the shop';
