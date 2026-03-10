-- Complete Seller Restriction/Ban System
-- This migration sets up the full seller restriction system

-- 1. Ensure profiles table has restriction columns (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'seller_status') THEN
        ALTER TABLE profiles
        ADD COLUMN seller_status TEXT DEFAULT 'active' CHECK (seller_status IN ('active', 'restricted', 'banned'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'seller_restriction_reason') THEN
        ALTER TABLE profiles
        ADD COLUMN seller_restriction_reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'seller_restricted_at') THEN
        ALTER TABLE profiles
        ADD COLUMN seller_restricted_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'seller_restricted_by') THEN
        ALTER TABLE profiles
        ADD COLUMN seller_restricted_by UUID REFERENCES profiles(id);
    END IF;
END $$;

-- 2. Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_seller_status ON profiles(seller_status);

-- 3. Create seller_restrictions table for history tracking
CREATE TABLE IF NOT EXISTS seller_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    restricted_by UUID NOT NULL REFERENCES profiles(id),
    restriction_type TEXT NOT NULL CHECK (restriction_type IN ('restricted', 'banned', 'unrestricted')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Add indexes for seller_restrictions
CREATE INDEX IF NOT EXISTS idx_seller_restrictions_seller_id ON seller_restrictions(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_restrictions_created_at ON seller_restrictions(created_at DESC);

-- 4. Add notification types for restrictions (update CHECK constraint)
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

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

  -- Dispute notifications
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

  -- Seller restriction notifications (NEW)
  'seller_restricted',
  'seller_banned',
  'seller_unrestricted',

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

-- 5. Enable RLS on seller_restrictions
ALTER TABLE seller_restrictions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for seller_restrictions
-- Sellers can view their own restriction history
CREATE POLICY "Sellers can view own restrictions"
ON seller_restrictions FOR SELECT
TO authenticated
USING (seller_id = auth.uid());

-- Admins can view all restrictions
CREATE POLICY "Admins can view all restrictions"
ON seller_restrictions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_roles
        WHERE user_id = auth.uid()
    )
);

-- Admins can insert restrictions
CREATE POLICY "Admins can insert restrictions"
ON seller_restrictions FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_roles
        WHERE user_id = auth.uid()
    )
);

-- 7. Comments
COMMENT ON TABLE seller_restrictions IS 'History of all seller restrictions, bans, and unrestrictions';
COMMENT ON COLUMN profiles.seller_status IS 'Current seller status: active (normal), restricted (cannot create/publish listings), banned (no seller access)';
COMMENT ON COLUMN profiles.seller_restriction_reason IS 'Admin reason for restriction/ban';
COMMENT ON COLUMN profiles.seller_restricted_at IS 'Timestamp when restriction was applied';
COMMENT ON COLUMN profiles.seller_restricted_by IS 'Admin user ID who applied the restriction';
