-- Comprehensive RLS Policies for All Sensitive Tables
-- Date: 2026-02-09
-- Ensures proper data isolation and security across the platform

-- ============================================================================
-- LISTING PRICE HISTORY
-- ============================================================================

ALTER TABLE listing_price_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Sellers can view their listing price history" ON listing_price_history;
DROP POLICY IF EXISTS "System can insert price history" ON listing_price_history;
DROP POLICY IF EXISTS "Admins can view all price history" ON listing_price_history;

-- Sellers can view price history for their own listings
CREATE POLICY "Sellers can view their listing price history"
ON listing_price_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM listings
    WHERE listings.id = listing_price_history.listing_id
    AND listings.seller_id = auth.uid()
  )
);

-- System/triggers can insert price history
CREATE POLICY "System can insert price history"
ON listing_price_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM listings
    WHERE listings.id = listing_price_history.listing_id
    AND listings.seller_id = auth.uid()
  )
);

-- Admins can view all price history
CREATE POLICY "Admins can view all price history"
ON listing_price_history
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE admin_roles.user_id = auth.uid()
    AND admin_roles.is_active = true
  )
);

-- ============================================================================
-- SELLER PRESENCE (Online/Offline Status)
-- ============================================================================

ALTER TABLE seller_presence ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view seller presence" ON seller_presence;
DROP POLICY IF EXISTS "Sellers can update their own presence" ON seller_presence;

-- Everyone can view seller presence (needed for "Online Now" filter)
CREATE POLICY "Public can view seller presence"
ON seller_presence
FOR SELECT
TO public
USING (true);

-- Sellers can update their own presence
CREATE POLICY "Sellers can update their own presence"
ON seller_presence
FOR ALL
TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

-- ============================================================================
-- TRUSTPILOT INVITATIONS
-- ============================================================================
-- Note: RLS policies for trustpilot_invitations are already defined in
-- 20260206_create_trustpilot_invitations.sql
-- Skipping to avoid duplication

-- ============================================================================
-- DISPUTES
-- ============================================================================

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Buyers can view their disputes" ON disputes;
DROP POLICY IF EXISTS "Sellers can view their disputes" ON disputes;
DROP POLICY IF EXISTS "Buyers can create disputes" ON disputes;
DROP POLICY IF EXISTS "Admins can manage all disputes" ON disputes;

-- Buyers can view their own disputes
CREATE POLICY "Buyers can view their disputes"
ON disputes
FOR SELECT
TO authenticated
USING (buyer_id = auth.uid());

-- Sellers can view their own disputes
CREATE POLICY "Sellers can view their disputes"
ON disputes
FOR SELECT
TO authenticated
USING (seller_id = auth.uid());

-- Buyers can create disputes
CREATE POLICY "Buyers can create disputes"
ON disputes
FOR INSERT
TO authenticated
WITH CHECK (buyer_id = auth.uid());

-- Admins can manage all disputes
CREATE POLICY "Admins can manage all disputes"
ON disputes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE admin_roles.user_id = auth.uid()
    AND admin_roles.is_active = true
    AND admin_roles.role IN ('admin', 'super_admin', 'moderator')
  )
);

-- ============================================================================
-- DISPUTE MESSAGES
-- ============================================================================

ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their dispute messages" ON dispute_messages;
DROP POLICY IF EXISTS "Users can create dispute messages" ON dispute_messages;

-- Users can view messages in their disputes
CREATE POLICY "Users can view their dispute messages"
ON dispute_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM disputes
    WHERE disputes.id = dispute_messages.dispute_id
    AND (
      disputes.buyer_id = auth.uid()
      OR disputes.seller_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM admin_roles
        WHERE admin_roles.user_id = auth.uid()
        AND admin_roles.is_active = true
      )
    )
  )
);

-- Users can insert messages in their disputes
CREATE POLICY "Users can create dispute messages"
ON dispute_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM disputes
    WHERE disputes.id = dispute_messages.dispute_id
    AND (
      disputes.buyer_id = auth.uid()
      OR disputes.seller_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM admin_roles
        WHERE admin_roles.user_id = auth.uid()
        AND admin_roles.is_active = true
      )
    )
  )
);

-- ============================================================================
-- ADMIN ACTIVITY LOG
-- ============================================================================

ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view activity log" ON admin_activity_log;
DROP POLICY IF EXISTS "System can insert activity log" ON admin_activity_log;

-- Only admins can view activity log
CREATE POLICY "Admins can view activity log"
ON admin_activity_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE admin_roles.user_id = auth.uid()
    AND admin_roles.is_active = true
  )
);

-- System can insert activity log
CREATE POLICY "System can insert activity log"
ON admin_activity_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE admin_roles.user_id = auth.uid()
    AND admin_roles.is_active = true
  )
);

-- ============================================================================
-- ADMIN NOTIFICATIONS
-- ============================================================================

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view their notifications" ON admin_notifications;

-- Admins can view their own notifications
CREATE POLICY "Admins can view their notifications"
ON admin_notifications
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE admin_roles.user_id = auth.uid()
    AND admin_roles.is_active = true
  )
);

-- ============================================================================
-- LISTING TEMPLATES (if not already protected)
-- ============================================================================

ALTER TABLE listing_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view listing templates" ON listing_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON listing_templates;

-- Everyone can view templates (needed for create listing flow)
CREATE POLICY "Public can view listing templates"
ON listing_templates
FOR SELECT
TO public
USING (is_active = true);

-- Only admins can manage templates
CREATE POLICY "Admins can manage templates"
ON listing_templates
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE admin_roles.user_id = auth.uid()
    AND admin_roles.is_active = true
    AND admin_roles.role IN ('admin', 'super_admin')
  )
);

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE listing_price_history IS 'RLS enabled: Sellers can view their own price history, admins can view all';
COMMENT ON TABLE seller_presence IS 'RLS enabled: Public read for online status, sellers can update own status';
COMMENT ON TABLE disputes IS 'RLS enabled: Buyers and sellers can view their own disputes, admins manage all';
COMMENT ON TABLE dispute_messages IS 'RLS enabled: Dispute participants can view/create messages';
COMMENT ON TABLE admin_activity_log IS 'RLS enabled: Admin-only access for security auditing';
COMMENT ON TABLE listing_templates IS 'RLS enabled: Public read, admin-only write';
