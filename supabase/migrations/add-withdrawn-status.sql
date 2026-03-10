-- Add 'withdrawn' status to seller_applications table
-- This allows users to withdraw their pending/under_review applications

-- Drop the existing constraint
alter table seller_applications
drop constraint if exists seller_applications_status_check;

-- Add new constraint with 'withdrawn' status
alter table seller_applications
add constraint seller_applications_status_check
check (status in ('pending', 'approved', 'rejected', 'info_requested', 'under_review', 'withdrawn'));
