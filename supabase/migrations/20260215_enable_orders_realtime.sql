-- Enable real-time updates for orders table
-- This allows Supabase Realtime to broadcast INSERT, UPDATE, and DELETE events
-- to subscribed clients for seamless real-time order status updates

-- Enable REPLICA IDENTITY FULL for orders table
-- This is required for Supabase Realtime to broadcast UPDATE and DELETE events
-- Without this, only INSERT events would be broadcasted
ALTER TABLE orders REPLICA IDENTITY FULL;

-- Add orders table to the supabase_realtime publication
-- This tells Postgres to start broadcasting changes to this table
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Add helpful comment for documentation
COMMENT ON TABLE orders IS 'Orders table with REPLICA IDENTITY FULL enabled for real-time subscriptions. Broadcasts INSERT, UPDATE, and DELETE events to subscribed clients.';
