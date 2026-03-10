-- ============================================
-- PHASE 2: ADMIN DASHBOARD SYSTEM
-- GameVault Admin System
-- Version: 1.0
-- Date: 2026-01-27
-- ============================================

-- ============================================
-- 1. UPDATE PROFILES TABLE FOR ADMIN SYSTEM
-- ============================================

-- Add role column to profiles (replacing seller_tier admin checks)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user'
  CHECK (role IN ('user', 'seller', 'admin', 'moderator', 'support', 'super_admin'));

-- Add badges column for visual indicators
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS badges text[] DEFAULT '{}';
-- Badges: 'verified', 'support', 'moderator', 'admin', 'developer'

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_badges ON profiles USING GIN(badges);

-- ============================================
-- 2. ADMIN ACTION LOGS TABLE (Audit Trail)
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Who performed the action
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,

  -- What action was performed
  action_type text CHECK (action_type IN (
    'application_approved',
    'application_rejected',
    'application_reviewed',
    'application_info_requested',
    'document_verified',
    'document_rejected',
    'dispute_assigned',
    'dispute_resolved',
    'dispute_escalated',
    'user_suspended',
    'user_unsuspended',
    'user_banned',
    'seller_tier_changed',
    'role_changed',
    'badge_added',
    'badge_removed',
    'notes_updated'
  )) NOT NULL,

  -- What was the target
  target_type text CHECK (target_type IN (
    'application',
    'user',
    'dispute',
    'document',
    'transaction'
  )) NOT NULL,

  target_id uuid NOT NULL,

  -- Additional details (JSON)
  details jsonb DEFAULT '{}',

  -- Request metadata
  ip_address inet,
  user_agent text,

  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_admin_logs_admin_id ON admin_action_logs(admin_id);
CREATE INDEX idx_admin_logs_action_type ON admin_action_logs(action_type);
CREATE INDEX idx_admin_logs_target ON admin_action_logs(target_type, target_id);
CREATE INDEX idx_admin_logs_created_at ON admin_action_logs(created_at DESC);

-- ============================================
-- 3. DISPUTES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.disputes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Dispute parties
  filed_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  filed_against uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Transaction reference (nullable for now until transactions table exists)
  transaction_id uuid, -- Will add foreign key later
  order_number text,

  -- Dispute details
  dispute_type text CHECK (dispute_type IN (
    'payment_issue',
    'delivery_issue',
    'product_not_as_described',
    'account_access',
    'refund_request',
    'seller_misconduct',
    'buyer_misconduct',
    'fraud_suspected',
    'other'
  )) NOT NULL,

  status text DEFAULT 'open' CHECK (status IN (
    'open',
    'under_review',
    'awaiting_buyer_response',
    'awaiting_seller_response',
    'resolved',
    'closed',
    'escalated'
  )) NOT NULL,

  priority text DEFAULT 'medium' CHECK (priority IN (
    'low',
    'medium',
    'high',
    'urgent'
  )) NOT NULL,

  subject text NOT NULL,
  description text NOT NULL,

  -- Financial details
  disputed_amount decimal(10,2),
  refund_amount decimal(10,2),

  -- Resolution
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_notes text,
  resolution_type text CHECK (resolution_type IN (
    'refund_full',
    'refund_partial',
    'replacement',
    'no_action',
    'ban_user',
    'warning_issued'
  )),

  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_disputes_filed_by ON disputes(filed_by);
CREATE INDEX idx_disputes_filed_against ON disputes(filed_against);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_priority ON disputes(priority);
CREATE INDEX idx_disputes_assigned_to ON disputes(assigned_to);
CREATE INDEX idx_disputes_created_at ON disputes(created_at DESC);

-- ============================================
-- 4. DISPUTE MESSAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.dispute_messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  dispute_id uuid REFERENCES disputes(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  message text NOT NULL,
  is_internal boolean DEFAULT false, -- Admin-only internal notes

  attachments jsonb DEFAULT '[]',

  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_dispute_messages_dispute_id ON dispute_messages(dispute_id);
CREATE INDEX idx_dispute_messages_sender_id ON dispute_messages(sender_id);
CREATE INDEX idx_dispute_messages_created_at ON dispute_messages(created_at);

-- ============================================
-- 5. ADMIN NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

  notification_type text CHECK (notification_type IN (
    'new_application',
    'new_dispute',
    'urgent_dispute',
    'document_expiring',
    'fraud_alert',
    'system_alert',
    'high_value_transaction',
    'mass_report'
  )) NOT NULL,

  title text NOT NULL,
  message text NOT NULL,

  link text, -- URL to relevant admin page

  -- Who should see this
  target_roles text[] DEFAULT ARRAY['admin', 'super_admin'],
  specific_admin_id uuid REFERENCES profiles(id) ON DELETE CASCADE,

  -- Read status
  read boolean DEFAULT false,
  read_at timestamptz,
  read_by uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Priority
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_admin_notifications_created_at ON admin_notifications(created_at DESC);
CREATE INDEX idx_admin_notifications_read ON admin_notifications(read);
CREATE INDEX idx_admin_notifications_target_roles ON admin_notifications USING GIN(target_roles);
CREATE INDEX idx_admin_notifications_specific_admin ON admin_notifications(specific_admin_id);

-- ============================================
-- 6. UPDATE RLS POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admin Action Logs Policies
CREATE POLICY "Admins can view action logs"
  ON admin_action_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "System can create action logs"
  ON admin_action_logs FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Any authenticated user can log actions (controlled in app layer)

-- Disputes Policies
CREATE POLICY "Users can view their own disputes"
  ON disputes FOR SELECT
  TO authenticated
  USING (auth.uid() IN (filed_by, filed_against));

CREATE POLICY "Users can create disputes"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = filed_by);

CREATE POLICY "Admins can view all disputes"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'moderator', 'support', 'super_admin')
    )
  );

CREATE POLICY "Admins can update disputes"
  ON disputes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'support', 'super_admin')
    )
  );

-- Dispute Messages Policies
CREATE POLICY "Users can view non-internal messages in their disputes"
  ON dispute_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM disputes
      WHERE disputes.id = dispute_messages.dispute_id
      AND auth.uid() IN (disputes.filed_by, disputes.filed_against)
      AND dispute_messages.is_internal = false
    )
  );

CREATE POLICY "Users can send messages in their disputes"
  ON dispute_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND is_internal = false
    AND EXISTS (
      SELECT 1 FROM disputes
      WHERE disputes.id = dispute_id
      AND auth.uid() IN (disputes.filed_by, disputes.filed_against)
    )
  );

CREATE POLICY "Admins can view all dispute messages"
  ON dispute_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'moderator', 'support', 'super_admin')
    )
  );

CREATE POLICY "Admins can send any messages"
  ON dispute_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'support', 'super_admin')
    )
  );

-- Admin Notifications Policies
CREATE POLICY "Admins can view notifications for their role"
  ON admin_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (
        role = ANY(target_roles)
        OR id = specific_admin_id
      )
    )
  );

CREATE POLICY "Admins can update notification read status"
  ON admin_notifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (
        role = ANY(target_roles)
        OR id = specific_admin_id
      )
    )
  );

-- ============================================
-- 7. UPDATE EXISTING SELLER APPLICATION POLICIES
-- ============================================

-- Drop old platinum-based policies
DROP POLICY IF EXISTS "Admins can view all applications" ON seller_applications;
DROP POLICY IF EXISTS "Admins can view all documents" ON seller_kyc_documents;
DROP POLICY IF EXISTS "Admins can view all logs" ON seller_verification_logs;

-- New role-based policies for seller_applications
CREATE POLICY "Admins can view all seller applications"
  ON seller_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator', 'support', 'super_admin')
    )
  );

CREATE POLICY "Admins can update seller applications"
  ON seller_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- New policies for seller_kyc_documents
CREATE POLICY "Admins can view all KYC documents"
  ON seller_kyc_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator', 'support', 'super_admin')
    )
  );

CREATE POLICY "Admins can update KYC documents"
  ON seller_kyc_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- New policies for seller_verification_logs
CREATE POLICY "Admins can view all verification logs"
  ON seller_verification_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator', 'support', 'super_admin')
    )
  );

CREATE POLICY "Admins can create verification logs"
  ON seller_verification_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator', 'support', 'super_admin')
    )
  );

-- ============================================
-- 8. STORAGE POLICIES FOR ADMINS
-- ============================================

-- Drop old storage policy if exists
DROP POLICY IF EXISTS "Admins can view all KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read KYC storage" ON storage.objects;

-- Create new storage policy for admins
CREATE POLICY "Admins can read KYC documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'moderator', 'super_admin')
    )
  );

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role IN ('admin', 'moderator', 'support', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid DEFAULT auth.uid())
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM profiles
  WHERE id = user_id;

  RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check specific role
CREATE OR REPLACE FUNCTION has_role(required_role text, user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to disputes table
DROP TRIGGER IF EXISTS update_disputes_timestamp ON disputes;
CREATE TRIGGER update_disputes_timestamp
  BEFORE UPDATE ON disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_timestamp();

-- ============================================
-- 11. NOTIFICATION TRIGGERS
-- ============================================

-- Notify admins of new applications
CREATE OR REPLACE FUNCTION notify_admins_new_application()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify when application is submitted (has submitted_at timestamp)
  IF NEW.status = 'pending' AND NEW.submitted_at IS NOT NULL AND OLD.submitted_at IS NULL THEN
    INSERT INTO admin_notifications (
      notification_type,
      title,
      message,
      link,
      target_roles,
      priority
    ) VALUES (
      'new_application',
      'New Seller Application',
      'A new ' || COALESCE(NEW.seller_type, 'seller') || ' application has been submitted by ' || COALESCE(NEW.display_name, 'Unknown'),
      '/admin/sellers/' || NEW.id,
      ARRAY['admin', 'moderator', 'super_admin'],
      'normal'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notify_new_application ON seller_applications;
CREATE TRIGGER notify_new_application
  AFTER UPDATE ON seller_applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_new_application();

-- Notify admins of new disputes
CREATE OR REPLACE FUNCTION notify_admins_new_dispute()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.priority IN ('high', 'urgent') THEN
    INSERT INTO admin_notifications (
      notification_type,
      title,
      message,
      link,
      target_roles,
      priority
    ) VALUES (
      CASE WHEN NEW.priority = 'urgent' THEN 'urgent_dispute' ELSE 'new_dispute' END,
      'New ' || UPPER(NEW.priority) || ' Priority Dispute',
      'A ' || NEW.priority || ' priority dispute has been filed: ' || NEW.subject,
      '/admin/disputes/' || NEW.id,
      ARRAY['admin', 'support', 'super_admin'],
      NEW.priority
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notify_new_dispute ON disputes;
CREATE TRIGGER notify_new_dispute
  AFTER INSERT ON disputes
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_new_dispute();

-- ============================================
-- 12. INITIAL SUPER ADMIN SETUP
-- ============================================

-- Set your user as super_admin
UPDATE profiles
SET
  role = 'super_admin',
  badges = ARRAY['admin', 'verified']::text[]
WHERE id = '66e508c1-6131-4761-823f-4d3efdc199d7';

-- Create initial notification
INSERT INTO admin_notifications (
  notification_type,
  title,
  message,
  link,
  target_roles,
  priority
) VALUES (
  'system_alert',
  'Admin System Initialized',
  'Phase 2 Admin Dashboard has been successfully deployed. You now have super_admin privileges.',
  '/admin',
  ARRAY['super_admin'],
  'normal'
);

-- ============================================
-- 13. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE disputes IS 'User dispute resolution system for handling conflicts between buyers and sellers';
COMMENT ON TABLE dispute_messages IS 'Messages within dispute threads, supports internal admin notes';
COMMENT ON TABLE admin_action_logs IS 'Immutable audit trail for all administrative actions';
COMMENT ON TABLE admin_notifications IS 'Real-time notification system for admin dashboard';
COMMENT ON COLUMN profiles.role IS 'User role in the system: user, seller, admin, moderator, support, super_admin';
COMMENT ON COLUMN profiles.badges IS 'Visual badges for user profiles: verified, support, moderator, admin, developer';
COMMENT ON COLUMN disputes.transaction_id IS 'Reference to transaction table (nullable until transactions table exists)';
COMMENT ON COLUMN dispute_messages.is_internal IS 'If true, message is only visible to admins (internal notes)';

-- ============================================
-- END OF MIGRATION
-- ============================================