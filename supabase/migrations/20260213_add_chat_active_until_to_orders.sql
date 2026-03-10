-- Add chat_active_until column to orders for chat lifecycle management
-- Chat should be active until 7 days after order completion

-- Add the column
ALTER TABLE orders
ADD COLUMN chat_active_until timestamptz;

-- Create index for performance (queries will check if chat is still active)
CREATE INDEX idx_orders_chat_active_until ON orders(chat_active_until);

-- Add comment
COMMENT ON COLUMN orders.chat_active_until IS 'Chat remains active until this time. Set to 7 days after order completion. Admins can override for disputes.';

-- Trigger to automatically set chat_active_until when order is completed
CREATE OR REPLACE FUNCTION set_chat_active_until()
RETURNS TRIGGER AS $$
BEGIN
  -- When order status changes to 'completed', set chat_active_until to 7 days from now
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    NEW.chat_active_until := NOW() + INTERVAL '7 days';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_set_chat_active_until
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_chat_active_until();
