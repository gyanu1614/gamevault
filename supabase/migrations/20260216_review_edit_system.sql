/**
 * Review Edit System Migration
 *
 * Features:
 * - Extend edit window from 7 days to 30 days
 * - Add edit tracking fields to reviews table
 * - Create review_edit_history table for audit trail
 * - Update RLS policies for 30-day window and edit frequency
 * - Fix admin RLS policy to use admin_roles table
 */

-- ============================================================================
-- 1. Add Edit Tracking Fields to Reviews Table
-- ============================================================================

ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- Add check constraint to ensure edit_count is non-negative
ALTER TABLE reviews
ADD CONSTRAINT review_edit_count_positive CHECK (edit_count >= 0);

COMMENT ON COLUMN reviews.edit_count IS 'Number of times this review has been edited';
COMMENT ON COLUMN reviews.last_edited_at IS 'Timestamp of the most recent edit';

-- ============================================================================
-- 2. Create Review Edit History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS review_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  editor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What changed
  old_rating INTEGER,
  new_rating INTEGER,
  old_comment TEXT,
  new_comment TEXT,
  old_title TEXT,
  new_title TEXT,

  -- When
  edited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Metadata
  edit_reason TEXT,
  ip_address INET,
  user_agent TEXT,

  CONSTRAINT rating_valid CHECK (
    (old_rating IS NULL OR old_rating BETWEEN 1 AND 5) AND
    (new_rating IS NULL OR new_rating BETWEEN 1 AND 5)
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_review_edit_history_review_id
  ON review_edit_history(review_id, edited_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_edit_history_editor_id
  ON review_edit_history(editor_id, edited_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_edit_history_edited_at
  ON review_edit_history(edited_at DESC);

COMMENT ON TABLE review_edit_history IS 'Audit trail of all review edits for moderation and transparency';

-- ============================================================================
-- 3. Update RLS Policies - Extend Edit Window to 30 Days
-- ============================================================================

-- Drop old 7-day policy
DROP POLICY IF EXISTS "Reviewers can update own reviews" ON reviews;
DROP POLICY IF EXISTS "Reviewers can update their own reviews" ON reviews;

-- Create new 30-day policy with edit frequency limit
CREATE POLICY "Reviewers can update own reviews within 30 days"
  ON reviews FOR UPDATE
  USING (
    auth.uid() = reviewer_id AND
    created_at > now() - INTERVAL '30 days' AND
    (
      last_edited_at IS NULL OR
      last_edited_at < now() - INTERVAL '24 hours'
    )
  )
  WITH CHECK (
    auth.uid() = reviewer_id AND
    created_at > now() - INTERVAL '30 days'
  );

COMMENT ON POLICY "Reviewers can update own reviews within 30 days" ON reviews IS
  'Buyers can edit their reviews within 30 days, but only once per 24 hours';

-- ============================================================================
-- 4. Fix Admin RLS Policy to Use admin_roles Table
-- ============================================================================

-- Drop old admin policy that referenced profiles.role
DROP POLICY IF EXISTS "Admins can manage all reviews" ON reviews;

-- Create new admin policy using admin_roles table
CREATE POLICY "Admins can manage all reviews"
  ON reviews FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id
      FROM admin_roles
      WHERE role IN ('super_admin', 'admin', 'moderator')
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id
      FROM admin_roles
      WHERE role IN ('super_admin', 'admin', 'moderator')
    )
  );

COMMENT ON POLICY "Admins can manage all reviews" ON reviews IS
  'Admins, super admins, and moderators have full access to all reviews';

-- ============================================================================
-- 5. RLS Policies for Review Edit History
-- ============================================================================

ALTER TABLE review_edit_history ENABLE ROW LEVEL SECURITY;

-- Policy 1: Anyone can insert edit history (system use)
CREATE POLICY "Allow inserting edit history"
  ON review_edit_history FOR INSERT
  WITH CHECK (
    auth.uid() = editor_id
  );

-- Policy 2: Admins can view all edit history
CREATE POLICY "Admins can view all edit history"
  ON review_edit_history FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id
      FROM admin_roles
      WHERE role IN ('super_admin', 'admin', 'moderator')
    )
  );

-- Policy 3: Reviewers can view their own edit history
CREATE POLICY "Reviewers can view own edit history"
  ON review_edit_history FOR SELECT
  USING (
    auth.uid() = editor_id
  );

-- ============================================================================
-- 6. Trigger to Auto-Update Edit Tracking
-- ============================================================================

CREATE OR REPLACE FUNCTION update_review_edit_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if content changed (not seller_response)
  IF (OLD.rating IS DISTINCT FROM NEW.rating) OR
     (OLD.comment IS DISTINCT FROM NEW.comment) OR
     (OLD.title IS DISTINCT FROM NEW.title) THEN

    -- Increment edit count
    NEW.edit_count = COALESCE(OLD.edit_count, 0) + 1;

    -- Update last edited timestamp
    NEW.last_edited_at = NOW();

    -- Insert into edit history
    INSERT INTO review_edit_history (
      review_id,
      editor_id,
      old_rating,
      new_rating,
      old_comment,
      new_comment,
      old_title,
      new_title
    ) VALUES (
      NEW.id,
      auth.uid(),
      OLD.rating,
      NEW.rating,
      OLD.comment,
      NEW.comment,
      OLD.title,
      NEW.title
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_review_edit_tracking ON reviews;

CREATE TRIGGER trigger_update_review_edit_tracking
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  WHEN (
    OLD.rating IS DISTINCT FROM NEW.rating OR
    OLD.comment IS DISTINCT FROM NEW.comment OR
    OLD.title IS DISTINCT FROM NEW.title
  )
  EXECUTE FUNCTION update_review_edit_tracking();

COMMENT ON FUNCTION update_review_edit_tracking() IS
  'Automatically track review edits and maintain edit history';

-- ============================================================================
-- 7. Create View for Admin Review Management
-- ============================================================================

CREATE OR REPLACE VIEW admin_review_overview AS
SELECT
  r.id,
  r.order_id,
  r.rating,
  r.comment,
  r.title,
  r.is_positive,
  r.is_visible,
  r.flagged_for_moderation,
  r.moderation_reason,
  r.edit_count,
  r.last_edited_at,
  r.created_at,
  r.updated_at,

  -- Reviewer info
  reviewer.id AS reviewer_id,
  reviewer.username AS reviewer_username,
  reviewer.email AS reviewer_email,

  -- Seller info
  seller.id AS seller_id,
  seller.username AS seller_username,
  seller.shop_name AS seller_shop_name,

  -- Listing info
  l.title AS listing_title,

  -- Game info
  g.name AS game_name,

  -- Edit history count
  (SELECT COUNT(*) FROM review_edit_history WHERE review_id = r.id) AS total_edits,

  -- Seller response status
  CASE
    WHEN r.seller_response IS NOT NULL THEN true
    ELSE false
  END AS has_seller_response

FROM reviews r
LEFT JOIN profiles reviewer ON r.reviewer_id = reviewer.id
LEFT JOIN profiles seller ON r.seller_id = seller.id
LEFT JOIN listings l ON r.listing_id = l.id
LEFT JOIN games g ON r.game_id = g.id
ORDER BY r.created_at DESC;

COMMENT ON VIEW admin_review_overview IS
  'Comprehensive view of all reviews with related data for admin management';

-- Grant access to admins
GRANT SELECT ON admin_review_overview TO authenticated;

-- ============================================================================
-- 8. Add Indexes for Performance
-- ============================================================================

-- Index for edit frequency check
CREATE INDEX IF NOT EXISTS idx_reviews_last_edited_at
  ON reviews(reviewer_id, last_edited_at)
  WHERE last_edited_at IS NOT NULL;

-- Index for 30-day edit window check
CREATE INDEX IF NOT EXISTS idx_reviews_created_at_reviewer
  ON reviews(reviewer_id, created_at DESC);

-- Index for flagged reviews (admin moderation)
CREATE INDEX IF NOT EXISTS idx_reviews_flagged_moderation
  ON reviews(flagged_for_moderation, created_at DESC)
  WHERE flagged_for_moderation = true;

-- Index for reviews with multiple edits (potential abuse)
CREATE INDEX IF NOT EXISTS idx_reviews_high_edit_count
  ON reviews(edit_count, reviewer_id)
  WHERE edit_count >= 3;

-- ============================================================================
-- 9. Helper Function for Edit Eligibility Check
-- ============================================================================

CREATE OR REPLACE FUNCTION can_edit_review(review_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  review_record RECORD;
  user_id UUID;
BEGIN
  user_id := auth.uid();

  IF user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT
    reviewer_id,
    created_at,
    last_edited_at
  INTO review_record
  FROM reviews
  WHERE id = review_id_param;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if user is the reviewer
  IF review_record.reviewer_id != user_id THEN
    RETURN false;
  END IF;

  -- Check if within 30-day window
  IF review_record.created_at < NOW() - INTERVAL '30 days' THEN
    RETURN false;
  END IF;

  -- Check if 24 hours have passed since last edit
  IF review_record.last_edited_at IS NOT NULL AND
     review_record.last_edited_at > NOW() - INTERVAL '24 hours' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_edit_review(UUID) IS
  'Check if current user can edit a specific review (30-day window, 24-hour frequency)';

-- ============================================================================
-- 10. Migration Complete
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Review edit system migration completed successfully';
  RAISE NOTICE '- Edit window extended to 30 days';
  RAISE NOTICE '- Edit frequency limited to once per 24 hours';
  RAISE NOTICE '- Edit tracking fields added to reviews table';
  RAISE NOTICE '- review_edit_history table created for audit trail';
  RAISE NOTICE '- Admin RLS policy fixed to use admin_roles table';
  RAISE NOTICE '- Helper functions and views created';
END $$;
