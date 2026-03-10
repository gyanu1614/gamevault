-- Add 'dispute_resolved' to the notifications type check constraint
-- Also adds 'order_cancelled' for completeness

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check,
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'new_order',
      'order_delivered',
      'order_completed',
      'order_cancelled',
      'new_message',
      'review_received',
      'payout_completed',
      'dispute_opened',
      'dispute_resolved',
      'system'
    )
  );
