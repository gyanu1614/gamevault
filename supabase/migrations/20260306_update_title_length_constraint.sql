-- Update title length constraint from 10 to 5 characters minimum
-- Drop the old constraint
ALTER TABLE listings DROP CONSTRAINT IF EXISTS title_length;

-- Add new constraint with 5 character minimum
ALTER TABLE listings ADD CONSTRAINT title_length CHECK (char_length(title) >= 5 AND char_length(title) <= 100);
