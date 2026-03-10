-- Migration: Create trustpilot_invitations table for review tracking
-- Date: 2026-02-06
-- Purpose: Track Trustpilot review invitations sent to buyers

-- Create trustpilot_invitations table
CREATE TABLE IF NOT EXISTS public.trustpilot_invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz,
  review_submitted boolean DEFAULT false NOT NULL,
  review_submitted_at timestamptz,
  review_url text,
  review_rating integer CHECK (review_rating >= 1 AND review_rating <= 5),
  invitation_token text UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(order_id)
);

-- Create indexes for performance
CREATE INDEX idx_trustpilot_buyer_id ON public.trustpilot_invitations(buyer_id);
CREATE INDEX idx_trustpilot_order_id ON public.trustpilot_invitations(order_id);
CREATE INDEX idx_trustpilot_sent_at ON public.trustpilot_invitations(sent_at DESC);
CREATE INDEX idx_trustpilot_scheduled_for ON public.trustpilot_invitations(scheduled_for) WHERE scheduled_for IS NOT NULL AND review_submitted = false;
CREATE INDEX idx_trustpilot_pending ON public.trustpilot_invitations(review_submitted, sent_at) WHERE review_submitted = false;

-- Add comments
COMMENT ON TABLE public.trustpilot_invitations IS 'Tracks Trustpilot review invitations sent to buyers after order completion';
COMMENT ON COLUMN public.trustpilot_invitations.scheduled_for IS 'When the invitation email should be sent (typically 7 days after order completion)';
COMMENT ON COLUMN public.trustpilot_invitations.invitation_token IS 'Unique token for tracking which invitation link was clicked';
COMMENT ON COLUMN public.trustpilot_invitations.review_url IS 'URL to the submitted Trustpilot review';

-- Enable Row Level Security
ALTER TABLE public.trustpilot_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Buyers can view their own invitations
CREATE POLICY "Buyers can view their own invitations"
  ON public.trustpilot_invitations
  FOR SELECT
  USING (buyer_id = auth.uid());

-- Admins can view all invitations
CREATE POLICY "Admins can view all invitations"
  ON public.trustpilot_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Service role can manage all invitations (for cron jobs)
CREATE POLICY "Service role can manage invitations"
  ON public.trustpilot_invitations
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_trustpilot_invitation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_trustpilot_invitation_timestamp_trigger ON public.trustpilot_invitations;
CREATE TRIGGER update_trustpilot_invitation_timestamp_trigger
  BEFORE UPDATE ON public.trustpilot_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_trustpilot_invitation_timestamp();

-- Create function to generate invitation token
CREATE OR REPLACE FUNCTION generate_trustpilot_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invitation_token IS NULL THEN
    NEW.invitation_token = encode(gen_random_bytes(32), 'base64');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate token
DROP TRIGGER IF EXISTS generate_trustpilot_token_trigger ON public.trustpilot_invitations;
CREATE TRIGGER generate_trustpilot_token_trigger
  BEFORE INSERT ON public.trustpilot_invitations
  FOR EACH ROW
  EXECUTE FUNCTION generate_trustpilot_token();

-- Create function to schedule Trustpilot invitation after order completion
CREATE OR REPLACE FUNCTION schedule_trustpilot_invitation()
RETURNS TRIGGER AS $$
DECLARE
  buyer_email text;
  days_delay integer := 7; -- Send invitation 7 days after completion
BEGIN
  -- Only proceed if order status changed to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get buyer email
    SELECT email INTO buyer_email
    FROM public.profiles
    WHERE id = NEW.buyer_id;

    -- Create invitation record
    INSERT INTO public.trustpilot_invitations (
      buyer_id,
      order_id,
      email,
      scheduled_for
    ) VALUES (
      NEW.buyer_id,
      NEW.id,
      buyer_email,
      now() + (days_delay || ' days')::interval
    )
    ON CONFLICT (order_id) DO NOTHING; -- Don't create duplicate invitations
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS schedule_trustpilot_invitation_trigger ON public.orders;
CREATE TRIGGER schedule_trustpilot_invitation_trigger
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION schedule_trustpilot_invitation();

-- Create function to get pending invitations ready to send
CREATE OR REPLACE FUNCTION get_pending_trustpilot_invitations()
RETURNS SETOF public.trustpilot_invitations AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.trustpilot_invitations
  WHERE review_submitted = false
  AND scheduled_for IS NOT NULL
  AND scheduled_for <= now()
  ORDER BY scheduled_for ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to mark invitation as sent
CREATE OR REPLACE FUNCTION mark_trustpilot_invitation_sent(invitation_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.trustpilot_invitations
  SET sent_at = now()
  WHERE id = invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON public.trustpilot_invitations TO authenticated;
GRANT ALL ON public.trustpilot_invitations TO service_role;

-- Add helpful statistics view
CREATE OR REPLACE VIEW trustpilot_stats AS
SELECT
  COUNT(*) as total_invitations,
  COUNT(*) FILTER (WHERE review_submitted = true) as reviews_submitted,
  COUNT(*) FILTER (WHERE review_submitted = false AND sent_at < now() - interval '14 days') as pending_reviews,
  ROUND(AVG(review_rating), 2) as average_rating,
  COUNT(*) FILTER (WHERE review_rating = 5) as five_star_reviews,
  COUNT(*) FILTER (WHERE review_rating >= 4) as positive_reviews
FROM public.trustpilot_invitations;

COMMENT ON VIEW trustpilot_stats IS 'Aggregated statistics for Trustpilot review invitations';

-- Grant access to stats view
GRANT SELECT ON trustpilot_stats TO authenticated;
