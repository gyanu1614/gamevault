-- Fix notification type constraint to include dispute-related types
-- This fixes the "new row violates check constraint" error

-- Step 1: Drop existing constraint (if exists)
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Step 2: Add updated constraint with all notification types including dispute types
-- This includes all existing types PLUS the new dispute-related types
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  -- Message notifications
  'new_message',
  'message_read',
  'conversation_started',
  'message_received',

  -- Order notifications
  'new_order',
  'order_paid',
  'order_delivering',
  'order_delivered',
  'order_completed',
  'order_cancelled',
  'order_refunded',
  'order_status_update',
  'order_confirmation',
  'payment_received',
  'delivery_confirmed',

  -- Dispute notifications (NEW)
  'new_dispute',
  'dispute_opened',
  'dispute_updated',
  'dispute_resolved',
  'dispute_escalated',
  'dispute_message',

  -- Review notifications
  'new_review',
  'review_response',
  'review_received',

  -- Seller notifications
  'seller_approved',
  'seller_rejected',
  'seller_application_updated',
  'payout_completed',
  'payout_failed',
  'new_sale',

  -- Admin notifications
  'admin_action_required',
  'system_announcement',

  -- VaultShield notifications
  'vaultshield_activated',
  'vaultshield_claim',

  -- Wallet notifications
  'wallet_topup',
  'wallet_cashback',
  'wallet_refund',
  'balance_update',

  -- System notifications
  'account_verified',
  'security_alert'
));

-- Add comment
COMMENT ON CONSTRAINT notifications_type_check ON notifications IS
'Allowed notification types including dispute-related notifications';
