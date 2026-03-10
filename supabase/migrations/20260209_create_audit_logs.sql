-- Create Audit Logs System
-- Date: 2026-02-09
-- Purpose: Track all critical operations for security and debugging

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Who performed the action
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role TEXT,

  -- What action was performed
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID,

  -- What changed
  old_data JSONB,
  new_data JSONB,
  changes JSONB, -- Computed diff of old_data and new_data

  -- Request metadata
  ip_address INET,
  user_agent TEXT,
  request_path TEXT,

  -- Success/Failure
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON public.audit_logs(record_id) WHERE record_id IS NOT NULL;
CREATE INDEX idx_audit_logs_user_email ON public.audit_logs(user_email) WHERE user_email IS NOT NULL;

-- Composite index for common filter combinations
CREATE INDEX idx_audit_logs_table_action ON public.audit_logs(table_name, action, created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Only admins can view audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE admin_roles.user_id = auth.uid()
    AND admin_roles.is_active = true
  )
);

-- System can insert audit logs (service role)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true); -- Allow any authenticated user to log their own actions

-- Super admins can delete old logs (for GDPR compliance)
CREATE POLICY "Super admins can delete audit logs"
ON public.audit_logs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE admin_roles.user_id = auth.uid()
    AND admin_roles.is_active = true
    AND admin_roles.role = 'super_admin'
  )
);

-- Create function to compute changes diff
CREATE OR REPLACE FUNCTION compute_audit_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Compute diff between old_data and new_data
  IF NEW.old_data IS NOT NULL AND NEW.new_data IS NOT NULL THEN
    NEW.changes = jsonb_object_agg(
      key,
      jsonb_build_object(
        'old', NEW.old_data -> key,
        'new', NEW.new_data -> key
      )
    )
    FROM (
      SELECT key
      FROM jsonb_each(NEW.old_data)
      WHERE NEW.old_data -> key IS DISTINCT FROM NEW.new_data -> key
    ) AS diff_keys;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-compute changes
DROP TRIGGER IF EXISTS compute_audit_changes_trigger ON public.audit_logs;
CREATE TRIGGER compute_audit_changes_trigger
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION compute_audit_changes();

-- Create view for recent security events
CREATE OR REPLACE VIEW recent_security_events AS
SELECT
  al.id,
  al.created_at,
  al.action,
  al.table_name,
  al.user_email,
  al.user_role,
  al.ip_address,
  al.success,
  al.error_message,
  p.username as user_name,
  p.seller_tier
FROM public.audit_logs al
LEFT JOIN public.profiles p ON p.id = al.user_id
WHERE al.created_at >= NOW() - INTERVAL '24 hours'
  AND al.action IN (
    'login_failed',
    'unauthorized_access',
    'listing_deleted',
    'order_created',
    'order_status_changed',
    'user_role_changed',
    'admin_action'
  )
ORDER BY al.created_at DESC
LIMIT 1000;

-- Create view for failed operations
CREATE OR REPLACE VIEW failed_operations AS
SELECT
  al.id,
  al.created_at,
  al.action,
  al.table_name,
  al.user_email,
  al.error_message,
  al.request_path,
  COUNT(*) OVER (
    PARTITION BY al.user_id, al.action
    ORDER BY al.created_at
    RANGE BETWEEN INTERVAL '1 hour' PRECEDING AND CURRENT ROW
  ) as failures_last_hour
FROM public.audit_logs al
WHERE al.success = false
  AND al.created_at >= NOW() - INTERVAL '7 days'
ORDER BY al.created_at DESC;

-- Create function to clean up old audit logs (for GDPR compliance)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
  AND action NOT IN ('admin_action', 'user_role_changed'); -- Keep critical logs longer

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO authenticated;
GRANT SELECT ON recent_security_events TO authenticated;
GRANT SELECT ON failed_operations TO authenticated;

-- Add comments
COMMENT ON TABLE public.audit_logs IS 'Audit trail for all critical operations. Auto-deletes records older than 90 days (except critical actions).';
COMMENT ON COLUMN public.audit_logs.action IS 'Action performed: listing_created, listing_updated, listing_deleted, order_created, etc.';
COMMENT ON COLUMN public.audit_logs.changes IS 'Auto-computed diff between old_data and new_data showing what changed';
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Cleanup function for GDPR compliance. Call with number of days to retain. Default: 90 days.';
COMMENT ON VIEW recent_security_events IS 'Last 24 hours of security-relevant events for monitoring dashboard';
COMMENT ON VIEW failed_operations IS 'Failed operations in last 7 days with failure rate per user';
