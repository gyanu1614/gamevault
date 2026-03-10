-- Migration: Add escrow and VaultShield columns to orders table
-- Date: 2026-02-06
-- Purpose: Support escrow system with auto-release timer and delivery evidence

-- Add escrow status tracking
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS escrow_status text DEFAULT 'held'
  CHECK (escrow_status IN ('held', 'released', 'refunded', 'frozen'));

-- Add auto-release timer
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS auto_release_at timestamptz;

-- Add release method tracking
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS release_method text
  CHECK (release_method IN ('auto', 'buyer_confirmed', 'admin', 'dispute_resolved'));

-- Add VaultShield protection level
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS vaultshield_level text DEFAULT 'standard'
  CHECK (vaultshield_level IN ('standard', 'enhanced', 'premium'));

-- Add delivery evidence requirement flag
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_evidence_required boolean DEFAULT false;

-- Add delivery evidence URLs
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_evidence_urls text[];

-- Add buyer confirmation timestamp
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS buyer_confirmed_at timestamptz;

-- Add seller delivery confirmation timestamp (separate from delivered_at)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS seller_marked_delivered_at timestamptz;

-- Create indexes for escrow queries
CREATE INDEX IF NOT EXISTS idx_orders_escrow_status ON public.orders(escrow_status);
CREATE INDEX IF NOT EXISTS idx_orders_auto_release ON public.orders(auto_release_at)
  WHERE status = 'delivered' AND escrow_status = 'held' AND auto_release_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_vaultshield_level ON public.orders(vaultshield_level);
CREATE INDEX IF NOT EXISTS idx_orders_evidence_required ON public.orders(delivery_evidence_required)
  WHERE delivery_evidence_required = true;

-- Add comments
COMMENT ON COLUMN public.orders.escrow_status IS 'Current escrow status: held (funds in escrow), released (paid to seller), refunded (returned to buyer), frozen (dispute active)';
COMMENT ON COLUMN public.orders.auto_release_at IS 'Timestamp when funds will be automatically released to seller if no action taken';
COMMENT ON COLUMN public.orders.release_method IS 'How the escrow was released: auto (48h timer), buyer_confirmed (early confirmation), admin (manual), dispute_resolved';
COMMENT ON COLUMN public.orders.vaultshield_level IS 'VaultShield protection level based on order value: standard (<$100), enhanced ($100-499), premium ($500+)';
COMMENT ON COLUMN public.orders.delivery_evidence_required IS 'Whether seller must upload screenshot/video proof of delivery';
COMMENT ON COLUMN public.orders.delivery_evidence_urls IS 'Array of URLs to delivery evidence files (screenshots, videos) stored in Supabase Storage';
COMMENT ON COLUMN public.orders.buyer_confirmed_at IS 'When buyer manually confirmed delivery (early release)';
COMMENT ON COLUMN public.orders.seller_marked_delivered_at IS 'When seller clicked "Mark as Delivered" (starts auto-release timer)';

-- Create trigger function to set VaultShield level and evidence requirement based on order value
CREATE OR REPLACE FUNCTION set_vaultshield_level_and_evidence()
RETURNS TRIGGER AS $$
BEGIN
  -- Set VaultShield level based on subtotal
  IF NEW.subtotal >= 500 THEN
    NEW.vaultshield_level = 'premium';
    NEW.delivery_evidence_required = true;
  ELSIF NEW.subtotal >= 100 THEN
    NEW.vaultshield_level = 'enhanced';
    NEW.delivery_evidence_required = true;
  ELSE
    NEW.vaultshield_level = 'standard';
    NEW.delivery_evidence_required = false;
  END IF;

  -- Set auto-release timer when status changes to delivered
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    NEW.seller_marked_delivered_at = now();
    NEW.auto_release_at = now() + interval '48 hours';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_vaultshield_level_trigger ON public.orders;
CREATE TRIGGER set_vaultshield_level_trigger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION set_vaultshield_level_and_evidence();

-- Create function to release escrow (called by auto-release or buyer confirmation)
CREATE OR REPLACE FUNCTION release_escrow(
  order_id uuid,
  method text DEFAULT 'auto'
)
RETURNS void AS $$
BEGIN
  UPDATE public.orders
  SET
    status = 'completed',
    escrow_status = 'released',
    release_method = method,
    completed_at = now()
  WHERE id = order_id
  AND escrow_status = 'held';

  -- Here we would also:
  -- 1. Trigger Stripe transfer to seller's connected account
  -- 2. Send notification emails to buyer and seller
  -- 3. Update seller stats (total_sales, total_revenue)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to freeze escrow (when dispute is opened)
CREATE OR REPLACE FUNCTION freeze_escrow(
  order_id uuid
)
RETURNS void AS $$
BEGIN
  UPDATE public.orders
  SET
    escrow_status = 'frozen',
    auto_release_at = NULL -- Cancel auto-release timer
  WHERE id = order_id
  AND escrow_status = 'held';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to refund escrow (after dispute resolved in buyer's favor)
CREATE OR REPLACE FUNCTION refund_escrow(
  order_id uuid
)
RETURNS void AS $$
BEGIN
  UPDATE public.orders
  SET
    status = 'refunded',
    escrow_status = 'refunded',
    completed_at = now()
  WHERE id = order_id
  AND escrow_status IN ('held', 'frozen');

  -- Here we would also:
  -- 1. Trigger Stripe refund
  -- 2. Send notification emails
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get orders ready for auto-release
CREATE OR REPLACE FUNCTION get_orders_ready_for_auto_release()
RETURNS SETOF public.orders AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.orders
  WHERE status = 'delivered'
  AND escrow_status = 'held'
  AND auto_release_at IS NOT NULL
  AND auto_release_at <= now()
  ORDER BY auto_release_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing orders to set default escrow status
UPDATE public.orders
SET escrow_status = CASE
  WHEN status IN ('completed', 'refunded') THEN 'released'
  WHEN status = 'disputed' THEN 'frozen'
  ELSE 'held'
END
WHERE escrow_status IS NULL;

-- Set VaultShield level for existing orders
UPDATE public.orders
SET
  vaultshield_level = CASE
    WHEN subtotal >= 500 THEN 'premium'
    WHEN subtotal >= 100 THEN 'enhanced'
    ELSE 'standard'
  END,
  delivery_evidence_required = CASE
    WHEN subtotal >= 100 THEN true
    ELSE false
  END
WHERE vaultshield_level IS NULL;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION release_escrow(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION freeze_escrow(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION refund_escrow(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION get_orders_ready_for_auto_release() TO service_role;
