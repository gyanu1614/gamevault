-- Fix notification type constraint to include all types used in the codebase
-- This fixes the constraint violation errors

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check,
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      -- Order notifications
      'new_order',
      'order_delivered',
      'order_completed',
      'order_cancelled',

      -- Message and review notifications
      'new_message',
      'review_received',

      -- Payment and payout notifications
      'payout_completed',

      -- Dispute notifications
      'dispute_opened',
      'dispute_resolved',
      'new_dispute',  -- Added: used in orders.ts:897

      -- Admin notifications
      'new_seller_application',  -- Added: used in seller-application.ts:207
      'fraud_alert_high',        -- Added: used in fraud-detection.ts:94
      'fraud_alert_medium',      -- Added: used in fraud-detection.ts:104
      'inform_threshold_crossed', -- Added: used in inform-act.ts:113
      'inform_disclosure_submitted', -- Added: used in inform-act.ts:232

      -- Generic system notification
      'system'
    )
  );

COMMENT ON CONSTRAINT notifications_type_check ON public.notifications IS
  'Updated 2026-02-25: Added missing notification types used across the application';
