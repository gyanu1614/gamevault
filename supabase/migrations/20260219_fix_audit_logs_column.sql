-- Fix: audit_logs triggers were using 'performed_by' but the actual column is 'user_id'
-- Recreate both affected functions with the correct column name

CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Bump optimistic-lock version
  NEW.version := OLD.version + 1;

  -- Validate transition
  IF NOT is_valid_order_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'Invalid order transition: % → %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Log the status transition to audit_logs (use correct column: user_id)
  INSERT INTO audit_logs (
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    user_id,
    created_at
  ) VALUES (
    'ORDER_STATUS_CHANGE',
    'orders',
    NEW.id::TEXT,
    jsonb_build_object('status', OLD.status, 'version', OLD.version),
    jsonb_build_object('status', NEW.status, 'version', NEW.version),
    auth.uid(),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Also fix the profiles privilege change trigger
CREATE OR REPLACE FUNCTION log_profile_privilege_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, user_id, created_at)
    VALUES ('ROLE_CHANGE', 'profiles', NEW.id::TEXT,
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role),
      auth.uid(), NOW());
  END IF;

  IF OLD.seller_tier IS DISTINCT FROM NEW.seller_tier THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, user_id, created_at)
    VALUES ('TIER_CHANGE', 'profiles', NEW.id::TEXT,
      jsonb_build_object('seller_tier', OLD.seller_tier),
      jsonb_build_object('seller_tier', NEW.seller_tier),
      auth.uid(), NOW());
  END IF;

  IF OLD.is_verified IS DISTINCT FROM NEW.is_verified THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data, user_id, created_at)
    VALUES ('VERIFICATION_CHANGE', 'profiles', NEW.id::TEXT,
      jsonb_build_object('is_verified', OLD.is_verified),
      jsonb_build_object('is_verified', NEW.is_verified),
      auth.uid(), NOW());
  END IF;

  RETURN NEW;
END;
$$;
