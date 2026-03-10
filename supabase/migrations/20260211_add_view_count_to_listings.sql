-- ============================================================================
-- ADD VIEW COUNT TO LISTINGS TABLE
-- Priority 1 - Marketplace Features
-- Created: 2026-02-11
-- ============================================================================

-- Add view_count column to listings table
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0 NOT NULL;

-- Create index for sorting by popularity
CREATE INDEX IF NOT EXISTS idx_listings_view_count
ON listings(view_count DESC)
WHERE status = 'active';

-- Create composite index for game/category filtering with view count
CREATE INDEX IF NOT EXISTS idx_listings_game_category_views
ON listings(game_id, category_id, view_count DESC)
WHERE status = 'active';

-- Update existing listings to have 0 views
UPDATE listings SET view_count = 0 WHERE view_count IS NULL;

-- Add comment
COMMENT ON COLUMN listings.view_count IS 'Number of times this listing has been viewed';
