-- Add verification status columns to seller_applications table
-- These columns track whether each verification type has been completed

ALTER TABLE public.seller_applications
ADD COLUMN IF NOT EXISTS identity_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS address_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS business_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tax_verified boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN seller_applications.identity_verified IS 'True if identity documents (ID, selfie) have been verified';
COMMENT ON COLUMN seller_applications.address_verified IS 'True if proof of address has been verified';
COMMENT ON COLUMN seller_applications.business_verified IS 'True if business documents (incorporation, license) have been verified';
COMMENT ON COLUMN seller_applications.tax_verified IS 'True if tax documents (W9, W8BEN, bank statement) have been verified';
