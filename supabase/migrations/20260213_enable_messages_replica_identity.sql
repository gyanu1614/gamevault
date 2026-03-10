-- Enable REPLICA IDENTITY for messages table
-- This is required for Supabase Realtime to work properly with UPDATE/DELETE events
-- Without this, the realtime subscription will not receive old values for updated/deleted rows

ALTER TABLE messages REPLICA IDENTITY FULL;

COMMENT ON TABLE messages IS 'Messages table with REPLICA IDENTITY FULL enabled for real-time subscriptions';
