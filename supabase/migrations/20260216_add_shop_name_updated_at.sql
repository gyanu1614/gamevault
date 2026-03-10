-- Add shop_name_updated_at timestamp to track when shop name was last changed
-- This enables the 1-month shop name change restriction

-- Add shop_name_updated_at column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS shop_name_updated_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN profiles.shop_name_updated_at IS 'Timestamp of last shop name change (NULL = never changed, allows first-time setup)';
