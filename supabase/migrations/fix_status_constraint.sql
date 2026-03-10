-- Quick Fix: Run this in your Supabase SQL Editor
-- This adds 'paused' and 'pending_approval' to the listings status constraint

-- Drop the existing constraint
ALTER TABLE public.listings
DROP CONSTRAINT IF EXISTS listings_status_check;

-- Add the updated constraint with all valid statuses
ALTER TABLE public.listings
ADD CONSTRAINT listings_status_check
CHECK (status IN ('draft', 'active', 'sold', 'archived', 'suspended', 'paused', 'pending_approval'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'listings_status_check';
