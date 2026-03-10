-- Migration: Add instant delivery inventory system
-- Purpose: Store encrypted codes/credentials for instant delivery listings
-- Date: 2026-03-06

-- Create instant_delivery_inventory table for storing encrypted codes/credentials
CREATE TABLE IF NOT EXISTS public.instant_delivery_inventory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,

  -- Delivery data (encrypted using pgcrypto)
  delivery_type VARCHAR(50) NOT NULL DEFAULT 'code' CHECK (delivery_type IN ('code', 'credentials', 'key', 'gift_card')),
  delivery_data TEXT NOT NULL, -- Encrypted data (code, username:password, etc)

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'reserved', 'invalid')),
  sold_to_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  sold_at timestamptz,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Audit trail for security
  decrypted_at timestamptz, -- Track when code was revealed to buyer
  decrypted_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Optional: Store hash for duplicate detection without exposing actual code
  code_hash TEXT, -- SHA256 hash of original code

  -- Constraints
  CONSTRAINT unique_available_code_per_listing UNIQUE (listing_id, code_hash, status)
);

-- Indexes for performance
CREATE INDEX idx_instant_inventory_listing ON public.instant_delivery_inventory(listing_id);
CREATE INDEX idx_instant_inventory_status ON public.instant_delivery_inventory(status) WHERE status = 'available';
CREATE INDEX idx_instant_inventory_order ON public.instant_delivery_inventory(sold_to_order_id) WHERE sold_to_order_id IS NOT NULL;
CREATE INDEX idx_instant_inventory_created_at ON public.instant_delivery_inventory(created_at);

-- Enable Row Level Security
ALTER TABLE public.instant_delivery_inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Sellers can see inventory count for their listings (but not actual codes)
CREATE POLICY "Sellers can view their listing inventory status"
  ON public.instant_delivery_inventory
  FOR SELECT
  USING (
    listing_id IN (
      SELECT id FROM public.listings WHERE seller_id = auth.uid()
    )
    -- Sellers can only see status, not decrypted data
    -- Actual decryption happens server-side only
  );

-- RLS Policy: Buyers can see their purchased code after order completion
CREATE POLICY "Buyers can view their purchased inventory"
  ON public.instant_delivery_inventory
  FOR SELECT
  USING (
    status = 'sold'
    AND sold_to_order_id IN (
      SELECT id FROM public.orders
      WHERE buyer_id = auth.uid()
      AND status IN ('completed', 'delivering')
    )
  );

-- RLS Policy: Only service role can insert inventory (via server actions)
CREATE POLICY "Service role can insert inventory"
  ON public.instant_delivery_inventory
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    -- Allow authenticated users if they own the listing
    listing_id IN (
      SELECT id FROM public.listings WHERE seller_id = auth.uid()
    )
  );

-- RLS Policy: Only service role can update inventory status
CREATE POLICY "Service role can update inventory"
  ON public.instant_delivery_inventory
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RLS Policy: Sellers can delete their unsold inventory
CREATE POLICY "Sellers can delete available inventory"
  ON public.instant_delivery_inventory
  FOR DELETE
  USING (
    status = 'available'
    AND listing_id IN (
      SELECT id FROM public.listings WHERE seller_id = auth.uid()
    )
  );

-- Add columns to orders table for instant delivery tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS instant_delivery_code TEXT, -- Decrypted code shown to buyer
  ADD COLUMN IF NOT EXISTS instant_delivery_inventory_id uuid REFERENCES public.instant_delivery_inventory(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instant_delivery_delivered_at timestamptz; -- When code was delivered

-- Index for order delivery lookups
CREATE INDEX IF NOT EXISTS idx_orders_instant_delivery_inventory
  ON public.orders(instant_delivery_inventory_id)
  WHERE instant_delivery_inventory_id IS NOT NULL;

-- Function: Get available inventory count for a listing
CREATE OR REPLACE FUNCTION get_available_inventory_count(p_listing_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM public.instant_delivery_inventory
  WHERE listing_id = p_listing_id
  AND status = 'available';
$$;

-- Function: Encrypt delivery data (called from server actions)
CREATE OR REPLACE FUNCTION encrypt_delivery_data(
  p_data TEXT,
  p_encryption_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encrypted_data TEXT;
BEGIN
  -- Use AES-256 encryption with pgcrypto
  encrypted_data := encode(
    encrypt(
      p_data::bytea,
      p_encryption_key::bytea,
      'aes'
    ),
    'base64'
  );

  RETURN encrypted_data;
END;
$$;

-- Function: Decrypt delivery data (called from server actions, strict access control)
CREATE OR REPLACE FUNCTION decrypt_delivery_data(
  p_encrypted_data TEXT,
  p_decryption_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  decrypted_data TEXT;
BEGIN
  -- Decrypt using AES-256
  decrypted_data := convert_from(
    decrypt(
      decode(p_encrypted_data, 'base64'),
      p_decryption_key::bytea,
      'aes'
    ),
    'utf8'
  );

  RETURN decrypted_data;
END;
$$;

-- Function: Automatically update listing quantity based on available inventory
CREATE OR REPLACE FUNCTION sync_listing_quantity_with_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update listing quantity to match available inventory count
  UPDATE public.listings
  SET quantity = (
    SELECT COUNT(*)
    FROM public.instant_delivery_inventory
    WHERE listing_id = NEW.listing_id
    AND status = 'available'
  )
  WHERE id = NEW.listing_id
  AND delivery_method = 'instant';

  RETURN NEW;
END;
$$;

-- Trigger: Sync quantity when inventory changes
CREATE TRIGGER trigger_sync_listing_quantity
  AFTER INSERT OR UPDATE OR DELETE ON public.instant_delivery_inventory
  FOR EACH ROW
  EXECUTE FUNCTION sync_listing_quantity_with_inventory();

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_available_inventory_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION encrypt_delivery_data(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_delivery_data(TEXT, TEXT) TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.instant_delivery_inventory IS
  'Stores encrypted codes, credentials, and keys for instant delivery listings. Data is encrypted at rest using pgcrypto.';
COMMENT ON COLUMN public.instant_delivery_inventory.delivery_data IS
  'Encrypted delivery data. Never exposed to client or admins. Only decrypted server-side for buyer.';
COMMENT ON COLUMN public.instant_delivery_inventory.code_hash IS
  'SHA256 hash of code for duplicate detection without exposing actual code.';
