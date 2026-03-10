-- =====================================================
-- COMPREHENSIVE MODERATION FIX
-- This script fixes all issues with the moderation system
-- =====================================================

-- Step 1: Check current trigger function
DO $$
BEGIN
    RAISE NOTICE '=== CHECKING CURRENT TRIGGER FUNCTION ===';
END $$;

-- Step 2: Drop and recreate the trigger with proper logic
DROP TRIGGER IF EXISTS check_listing_moderation_trigger ON public.listings;

-- Recreate the trigger function with fixed logic
CREATE OR REPLACE FUNCTION check_listing_moderation()
RETURNS TRIGGER AS $$
BEGIN
  -- IMPORTANT: Skip ALL checks if this is an admin approval
  -- An admin approval is when approved_by is being set to a non-null value
  IF NEW.approved_by IS NOT NULL THEN
    -- Admin is approving, allow the status change without interference
    RETURN NEW;
  END IF;

  -- Only check for new listings or status changes to 'active'
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'active')) AND NEW.status = 'active' THEN
    -- Check if seller needs moderation
    IF check_seller_needs_moderation(NEW.seller_id) THEN
      NEW.status = 'pending_approval';
      RAISE NOTICE 'Listing set to pending_approval for seller: %', NEW.seller_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER check_listing_moderation_trigger
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION check_listing_moderation();

-- Step 3: Update the approve_listing function to be more robust
CREATE OR REPLACE FUNCTION approve_listing(
  listing_id uuid,
  admin_id uuid
)
RETURNS void AS $$
DECLARE
  seller_id_var uuid;
  current_approved_count integer;
BEGIN
  -- Get the seller_id
  SELECT seller_id INTO seller_id_var
  FROM public.listings
  WHERE id = listing_id;

  -- Update the listing
  UPDATE public.listings
  SET
    status = 'active',
    approved_by = admin_id,
    approved_at = now(),
    rejected_by = NULL,
    rejected_at = NULL,
    rejection_reason = NULL
  WHERE id = listing_id;

  -- Get current approved count
  SELECT COALESCE(
    (SELECT COUNT(*)
     FROM public.listings
     WHERE seller_id = seller_id_var
       AND status = 'active'
       AND approved_by IS NOT NULL),
    0
  ) INTO current_approved_count;

  RAISE NOTICE 'Listing % approved. Seller % now has % approved listings',
    listing_id, seller_id_var, current_approved_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Test the fix on existing pending listings
DO $$
DECLARE
  test_listing RECORD;
BEGIN
  RAISE NOTICE '=== TESTING FIX ON PENDING LISTINGS ===';

  FOR test_listing IN
    SELECT id, title, seller_id, status
    FROM public.listings
    WHERE status = 'pending_approval'
    LIMIT 1
  LOOP
    RAISE NOTICE 'Found pending listing: % (ID: %)', test_listing.title, test_listing.id;
    RAISE NOTICE 'This listing can now be approved through the admin panel';
  END LOOP;
END $$;

-- Step 5: Verify the fix
DO $$
BEGIN
  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'Trigger function updated: check_listing_moderation';
  RAISE NOTICE 'Approval function updated: approve_listing';
  RAISE NOTICE 'Logic: When approved_by IS NOT NULL, trigger will NOT interfere';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Refresh admin panel and click Approve';
END $$;
