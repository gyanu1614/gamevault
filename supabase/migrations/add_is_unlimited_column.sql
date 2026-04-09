-- Add is_unlimited column to listings table
-- This column indicates whether a listing has unlimited quantity (e.g., digital codes that can be generated)

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN listings.is_unlimited IS 'Indicates if this listing has unlimited stock (e.g., auto-generated digital codes)';

-- Update existing instant delivery listings to be unlimited by default
-- (You can customize this logic as needed)
UPDATE listings
SET is_unlimited = TRUE
WHERE delivery_method = 'instant'
  AND is_unlimited IS NULL;
