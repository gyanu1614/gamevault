-- Fix the moderation trigger to allow admin approvals to bypass the check
-- This allows admins to approve listings even if the seller still needs moderation

CREATE OR REPLACE FUNCTION check_listing_moderation()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip moderation check if an admin is explicitly approving the listing
  -- (when approved_by is being set or updated)
  IF (TG_OP = 'UPDATE' AND NEW.approved_by IS NOT NULL AND OLD.approved_by IS NULL) THEN
    -- This is an admin approval, don't force back to pending_approval
    RETURN NEW;
  END IF;

  -- Only check for new listings being set to 'active'
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'active')) AND NEW.status = 'active' THEN
    -- Check if seller needs moderation
    IF check_seller_needs_moderation(NEW.seller_id) THEN
      NEW.status = 'pending_approval';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
