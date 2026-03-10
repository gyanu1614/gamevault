-- ============================================
-- ADMIN ACTIVITY LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES public.profiles(id) NOT NULL,

  -- Action details
  action TEXT NOT NULL,
  action_category TEXT NOT NULL,

  -- Target resource
  resource_type TEXT NOT NULL,
  resource_id UUID,
  resource_name TEXT,

  -- State changes
  previous_state JSONB,
  new_state JSONB,

  -- Additional context
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Request info
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Admins can view activity log
CREATE POLICY "Admins can view activity log"
  ON admin_activity_log FOR SELECT
  TO authenticated
  USING (public.has_permission('activity_log.view'));

-- Any admin can insert logs
CREATE POLICY "Admins can create activity logs"
  ON admin_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND admin_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_admin_id ON admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON admin_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_category ON admin_activity_log(action_category);
CREATE INDEX IF NOT EXISTS idx_activity_log_resource ON admin_activity_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON admin_activity_log(created_at DESC);
