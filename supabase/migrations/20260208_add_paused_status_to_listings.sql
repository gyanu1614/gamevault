-- Migration: Add 'paused' and 'pending_approval' to listings status constraint
-- Date: 2026-02-08
-- Description: Updates the listings_status_check constraint to include 'paused' and 'pending_approval' statuses

-- Drop the existing constraint
ALTER TABLE public.listings
DROP CONSTRAINT IF EXISTS listings_status_check;

-- Add the updated constraint with all valid statuses
ALTER TABLE public.listings
ADD CONSTRAINT listings_status_check
CHECK (status IN ('draft', 'active', 'sold', 'archived', 'suspended', 'paused', 'pending_approval'));

-- Comment for documentation
COMMENT ON CONSTRAINT listings_status_check ON public.listings IS
'Valid listing statuses: draft (not published), active (live), sold (purchased), archived (removed by seller), suspended (removed by admin), paused (temporarily inactive), pending_approval (awaiting moderation)';
