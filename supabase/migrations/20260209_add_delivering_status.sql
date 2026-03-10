-- Add 'delivering' status to orders and add delivering_at timestamp column
-- This allows sellers to mark orders as "processing/delivering" before final delivery

-- Add delivering_at column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivering_at timestamptz;

-- Update the status CHECK constraint to include 'delivering'
-- First, drop the existing constraint if it exists
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the new constraint with 'delivering' status
ALTER TABLE orders
ADD CONSTRAINT orders_status_check
CHECK (status IN ('pending', 'paid', 'delivering', 'delivered', 'completed', 'disputed', 'refunded', 'cancelled'));

-- Create index on delivering_at for performance
CREATE INDEX IF NOT EXISTS idx_orders_delivering_at ON orders(delivering_at);

-- Add comment
COMMENT ON COLUMN orders.delivering_at IS 'Timestamp when seller marked order as being delivered/processed';
