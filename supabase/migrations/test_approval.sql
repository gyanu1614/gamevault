-- TEST SCRIPT: Manually test the approval process
-- Run this AFTER running the comprehensive fix

-- Step 1: Check current state of pending listings
SELECT
  id,
  title,
  status,
  approved_by,
  approved_at,
  seller_id
FROM listings
WHERE status = 'pending_approval'
ORDER BY created_at DESC;

-- Step 2: Test approving one listing manually
-- Replace the listing_id and admin_id with actual values from your database
-- Get admin ID first
SELECT id as admin_id FROM profiles WHERE email = 'gyanu1614@gmail.com';

-- Get a pending listing ID
SELECT id as listing_id FROM listings WHERE status = 'pending_approval' LIMIT 1;

-- Now test the approve_listing function with YOUR actual IDs:
-- UNCOMMENT AND UPDATE THE LINE BELOW WITH ACTUAL IDs:
-- SELECT approve_listing('PASTE_LISTING_ID_HERE', 'PASTE_ADMIN_ID_HERE');

-- Step 3: Verify the listing status changed
SELECT
  id,
  title,
  status,
  approved_by,
  approved_at
FROM listings
WHERE id IN (
  SELECT id FROM listings WHERE approved_by IS NOT NULL ORDER BY approved_at DESC LIMIT 2
);

-- Step 4: Check how many active listings the seller has
SELECT
  p.username,
  p.email,
  COUNT(l.id) FILTER (WHERE l.status = 'active' AND l.approved_by IS NOT NULL) as approved_count,
  COUNT(l.id) FILTER (WHERE l.status = 'pending_approval') as pending_count
FROM profiles p
LEFT JOIN listings l ON l.seller_id = p.id
WHERE p.role = 'seller'
GROUP BY p.id, p.username, p.email;
