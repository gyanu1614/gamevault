-- =====================================================
-- MAKE ORDER_ID NULLABLE IN CONVERSATIONS
-- =====================================================
-- Allow direct messaging conversations without requiring an order
-- This enables the Contact Seller feature to work independently of orders

ALTER TABLE conversations
ALTER COLUMN order_id DROP NOT NULL;

-- Add a comment to document the change
COMMENT ON COLUMN conversations.order_id IS 'Optional: Order ID if conversation is related to a specific order. NULL for direct messaging.';
