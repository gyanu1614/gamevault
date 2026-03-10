-- ============================================================================
-- Allow Multiple Cancellation Requests Per Order (After Undo)
-- Created: 2026-03-02
-- Purpose: Remove unique constraint to allow buyers to re-request after undo
-- ============================================================================

-- Drop the unique constraint
ALTER TABLE order_cancellation_requests
DROP CONSTRAINT IF EXISTS order_cancellation_requests_order_id_key;

-- The application logic will handle preventing duplicate PENDING requests
-- Buyers can create new requests after undoing previous ones
