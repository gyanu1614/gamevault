-- Add listing_id column to conversations table for better data model
-- This allows querying conversations by listing and maintains referential integrity

-- Add the column
ALTER TABLE conversations
ADD COLUMN listing_id uuid REFERENCES listings(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_conversations_listing_id ON conversations(listing_id);

-- Add comment
COMMENT ON COLUMN conversations.listing_id IS 'Reference to the listing this conversation is about. Useful for analytics and querying conversations by listing.';
