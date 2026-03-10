-- Migration: Add rejection and withdrawal tracking to seller_applications
-- Date: 2026-02-08
-- Purpose: Track rejection reasons, cooldown periods, and withdrawal history

-- Add new columns to seller_applications table
ALTER TABLE public.seller_applications
ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS rejection_category text CHECK (rejection_category IN (
  'incomplete_documentation',
  'invalid_documents',
  'information_mismatch',
  'suspicious_activity',
  'business_verification_failed',
  'other'
)),
ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
ADD COLUMN IF NOT EXISTS can_reapply_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS withdrawal_count integer DEFAULT 0;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_seller_applications_can_reapply_at
  ON public.seller_applications(can_reapply_at)
  WHERE can_reapply_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seller_applications_rejected_at
  ON public.seller_applications(rejected_at DESC)
  WHERE rejected_at IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.seller_applications.rejected_at IS 'Timestamp when application was rejected by admin';
COMMENT ON COLUMN public.seller_applications.rejected_by IS 'Admin who rejected the application';
COMMENT ON COLUMN public.seller_applications.rejection_reason IS 'Detailed reason for rejection provided by admin';
COMMENT ON COLUMN public.seller_applications.rejection_category IS 'Category of rejection for analytics';
COMMENT ON COLUMN public.seller_applications.withdrawn_at IS 'Timestamp when seller withdrew their own application';
COMMENT ON COLUMN public.seller_applications.can_reapply_at IS 'Earliest timestamp when seller can reapply after rejection';
COMMENT ON COLUMN public.seller_applications.rejection_count IS 'Number of times this seller has been rejected (for tiered cooldown)';
COMMENT ON COLUMN public.seller_applications.withdrawal_count IS 'Number of times seller has withdrawn (for anti-spam)';

-- Create function to calculate cooldown period based on rejection count
CREATE OR REPLACE FUNCTION calculate_reapply_cooldown(rejection_count_param integer)
RETURNS interval AS $$
BEGIN
  RETURN CASE
    WHEN rejection_count_param = 0 THEN interval '7 days'    -- First rejection: 7 days
    WHEN rejection_count_param = 1 THEN interval '30 days'   -- Second rejection: 30 days
    WHEN rejection_count_param = 2 THEN interval '90 days'   -- Third rejection: 90 days
    ELSE interval '999 years'  -- 4+ rejections: permanent ban (requires appeal)
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_reapply_cooldown IS 'Calculates cooldown period: 1st=7d, 2nd=30d, 3rd=90d, 4+=permanent';

-- Create function to reject application with reason
CREATE OR REPLACE FUNCTION reject_seller_application(
  application_id_param uuid,
  admin_id_param uuid,
  rejection_reason_param text,
  rejection_category_param text
)
RETURNS jsonb AS $$
DECLARE
  current_rejection_count integer;
  cooldown_period interval;
  result jsonb;
BEGIN
  -- Get current rejection count
  SELECT rejection_count INTO current_rejection_count
  FROM public.seller_applications
  WHERE id = application_id_param;

  -- Calculate new rejection count and cooldown
  current_rejection_count := COALESCE(current_rejection_count, 0) + 1;
  cooldown_period := calculate_reapply_cooldown(current_rejection_count - 1);

  -- Update application
  UPDATE public.seller_applications
  SET
    status = 'rejected',
    rejected_at = now(),
    rejected_by = admin_id_param,
    rejection_reason = rejection_reason_param,
    rejection_category = rejection_category_param,
    rejection_count = current_rejection_count,
    can_reapply_at = now() + cooldown_period,
    updated_at = now()
  WHERE id = application_id_param;

  -- Build result
  result := jsonb_build_object(
    'success', true,
    'rejection_count', current_rejection_count,
    'can_reapply_at', now() + cooldown_period,
    'cooldown_days', EXTRACT(day FROM cooldown_period),
    'is_permanent_ban', current_rejection_count >= 4
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reject_seller_application IS 'Rejects application with tiered cooldown: 1st=7d, 2nd=30d, 3rd=90d, 4+=permanent';

-- Create function to withdraw application
CREATE OR REPLACE FUNCTION withdraw_seller_application(
  application_id_param uuid,
  user_id_param uuid
)
RETURNS jsonb AS $$
DECLARE
  current_withdrawal_count integer;
  result jsonb;
BEGIN
  -- Get current withdrawal count
  SELECT withdrawal_count INTO current_withdrawal_count
  FROM public.seller_applications
  WHERE id = application_id_param AND user_id = user_id_param;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found or unauthorized');
  END IF;

  -- Increment withdrawal count
  current_withdrawal_count := COALESCE(current_withdrawal_count, 0) + 1;

  -- Update application
  UPDATE public.seller_applications
  SET
    status = 'withdrawn',
    withdrawn_at = now(),
    withdrawal_count = current_withdrawal_count,
    updated_at = now()
  WHERE id = application_id_param;

  -- Check for spam (5+ withdrawals in 30 days)
  result := jsonb_build_object(
    'success', true,
    'withdrawal_count', current_withdrawal_count,
    'flagged_for_spam', current_withdrawal_count >= 5
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION withdraw_seller_application IS 'Allows seller to withdraw application, tracks withdrawal count for anti-spam';

-- Create function to check if seller can reapply
CREATE OR REPLACE FUNCTION can_seller_reapply(user_id_param uuid)
RETURNS jsonb AS $$
DECLARE
  latest_app record;
  result jsonb;
BEGIN
  -- Get latest application
  SELECT * INTO latest_app
  FROM public.seller_applications
  WHERE user_id = user_id_param
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- No application exists, can apply
    RETURN jsonb_build_object(
      'can_reapply', true,
      'reason', 'no_application'
    );
  END IF;

  -- Check various scenarios
  IF latest_app.status = 'approved' THEN
    RETURN jsonb_build_object(
      'can_reapply', false,
      'reason', 'already_approved',
      'message', 'You are already an approved seller'
    );
  END IF;

  IF latest_app.status IN ('pending', 'under_review') THEN
    RETURN jsonb_build_object(
      'can_reapply', false,
      'reason', 'pending_review',
      'message', 'Your application is currently under review'
    );
  END IF;

  IF latest_app.status = 'withdrawn' THEN
    -- Can reapply immediately after withdrawal
    RETURN jsonb_build_object(
      'can_reapply', true,
      'reason', 'withdrawn',
      'withdrawal_count', latest_app.withdrawal_count
    );
  END IF;

  IF latest_app.status = 'rejected' THEN
    IF latest_app.can_reapply_at IS NULL OR now() >= latest_app.can_reapply_at THEN
      -- Cooldown period has passed
      RETURN jsonb_build_object(
        'can_reapply', true,
        'reason', 'cooldown_expired',
        'rejection_count', latest_app.rejection_count
      );
    ELSE
      -- Still in cooldown period
      RETURN jsonb_build_object(
        'can_reapply', false,
        'reason', 'in_cooldown',
        'can_reapply_at', latest_app.can_reapply_at,
        'seconds_remaining', EXTRACT(EPOCH FROM (latest_app.can_reapply_at - now())),
        'rejection_count', latest_app.rejection_count,
        'rejection_reason', latest_app.rejection_reason,
        'rejection_category', latest_app.rejection_category,
        'is_permanent_ban', latest_app.rejection_count >= 4
      );
    END IF;
  END IF;

  -- Default: can reapply
  RETURN jsonb_build_object('can_reapply', true, 'reason', 'default');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_seller_reapply IS 'Checks if seller can reapply based on current status and cooldown periods';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_reapply_cooldown(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_seller_application(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION withdraw_seller_application(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_seller_reapply(uuid) TO authenticated;
