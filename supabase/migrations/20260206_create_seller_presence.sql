-- Migration: Create seller_presence table for online/offline tracking
-- Date: 2026-02-06
-- Purpose: Track seller online/offline status for real-time presence indicators

-- Create seller_presence table
CREATE TABLE IF NOT EXISTS public.seller_presence (
  seller_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_online boolean DEFAULT false NOT NULL,
  last_seen_at timestamptz DEFAULT now() NOT NULL,
  last_active_at timestamptz DEFAULT now() NOT NULL,
  status_message text,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_seller_presence_is_online ON public.seller_presence(is_online);
CREATE INDEX idx_seller_presence_last_seen ON public.seller_presence(last_seen_at DESC);
CREATE INDEX idx_seller_presence_online_sellers ON public.seller_presence(seller_id, is_online) WHERE is_online = true;

-- Add comments
COMMENT ON TABLE public.seller_presence IS 'Tracks real-time online/offline status of sellers';
COMMENT ON COLUMN public.seller_presence.last_seen_at IS 'Last time seller was detected online';
COMMENT ON COLUMN public.seller_presence.last_active_at IS 'Last time seller performed an action';
COMMENT ON COLUMN public.seller_presence.status_message IS 'Optional custom status message (e.g. "Away", "Busy")';

-- Enable Row Level Security
ALTER TABLE public.seller_presence ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Everyone can view seller presence
CREATE POLICY "Anyone can view seller presence"
  ON public.seller_presence
  FOR SELECT
  USING (true);

-- Sellers can update their own presence
CREATE POLICY "Sellers can update their own presence"
  ON public.seller_presence
  FOR ALL
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Service role can manage all presence records
CREATE POLICY "Service role can manage all presence"
  ON public.seller_presence
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create trigger function to auto-update timestamp
CREATE OR REPLACE FUNCTION update_seller_presence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.is_online = true THEN
    NEW.last_seen_at = now();
    NEW.last_active_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_seller_presence_timestamp_trigger ON public.seller_presence;
CREATE TRIGGER update_seller_presence_timestamp_trigger
  BEFORE UPDATE ON public.seller_presence
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_presence_timestamp();

-- Create function to mark seller offline after 5 minutes of inactivity
CREATE OR REPLACE FUNCTION mark_inactive_sellers_offline()
RETURNS void AS $$
BEGIN
  UPDATE public.seller_presence
  SET is_online = false
  WHERE is_online = true
  AND last_active_at < (now() - interval '5 minutes');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to initialize presence for new sellers
CREATE OR REPLACE FUNCTION initialize_seller_presence()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create presence record if user is a seller
  IF NEW.role = 'seller' OR NEW.seller_tier IS NOT NULL THEN
    INSERT INTO public.seller_presence (seller_id, is_online, last_seen_at, last_active_at)
    VALUES (NEW.id, false, now(), now())
    ON CONFLICT (seller_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles to auto-create presence
DROP TRIGGER IF EXISTS initialize_seller_presence_trigger ON public.profiles;
CREATE TRIGGER initialize_seller_presence_trigger
  AFTER INSERT OR UPDATE OF role, seller_tier ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION initialize_seller_presence();

-- Create function to update presence on activity
CREATE OR REPLACE FUNCTION track_seller_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Update seller presence when they perform actions
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.seller_presence (seller_id, is_online, last_active_at, last_seen_at)
    VALUES (auth.uid(), true, now(), now())
    ON CONFLICT (seller_id)
    DO UPDATE SET
      is_online = true,
      last_active_at = now(),
      last_seen_at = now(),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON public.seller_presence TO authenticated, anon;
GRANT INSERT, UPDATE ON public.seller_presence TO authenticated;
GRANT ALL ON public.seller_presence TO service_role;

-- Initialize presence for existing sellers
INSERT INTO public.seller_presence (seller_id, is_online, last_seen_at, last_active_at)
SELECT id, false, now(), now()
FROM public.profiles
WHERE role = 'seller' OR seller_tier IS NOT NULL
ON CONFLICT (seller_id) DO NOTHING;
