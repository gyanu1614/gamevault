-- Migration: Create listing_price_history table for tracking price changes
-- Date: 2026-02-06
-- Purpose: Track all price changes for listings to display price history charts

-- Create listing_price_history table
CREATE TABLE IF NOT EXISTS public.listing_price_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  old_price numeric(10,2) NOT NULL,
  new_price numeric(10,2) NOT NULL,
  changed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text CHECK (reason IN ('manual_change', 'market_adjustment', 'promotion', 'bulk_update')),
  changed_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_listing_price_history_listing_id ON public.listing_price_history(listing_id);
CREATE INDEX idx_listing_price_history_changed_at ON public.listing_price_history(changed_at DESC);
CREATE INDEX idx_listing_price_history_listing_date ON public.listing_price_history(listing_id, changed_at DESC);

-- Add comment
COMMENT ON TABLE public.listing_price_history IS 'Tracks all price changes for listings to display price history and market trends';

-- Enable Row Level Security
ALTER TABLE public.listing_price_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public can view price history for active listings
CREATE POLICY "Anyone can view price history for active listings"
  ON public.listing_price_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_price_history.listing_id
      AND listings.status IN ('active', 'sold')
    )
  );

-- Sellers can view their own listing price history
CREATE POLICY "Sellers can view their own listing price history"
  ON public.listing_price_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_price_history.listing_id
      AND listings.seller_id = auth.uid()
    )
  );

-- Only sellers can insert price history (via trigger)
CREATE POLICY "Sellers can insert price history for their listings"
  ON public.listing_price_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_price_history.listing_id
      AND listings.seller_id = auth.uid()
    )
  );

-- Admins can view all price history
CREATE POLICY "Admins can view all price history"
  ON public.listing_price_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Create trigger function to auto-track price changes
CREATE OR REPLACE FUNCTION track_listing_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if price actually changed
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO public.listing_price_history (
      listing_id,
      old_price,
      new_price,
      changed_by,
      reason
    ) VALUES (
      NEW.id,
      OLD.price,
      NEW.price,
      auth.uid(),
      'manual_change'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on listings table
DROP TRIGGER IF EXISTS track_listing_price_change_trigger ON public.listings;
CREATE TRIGGER track_listing_price_change_trigger
  AFTER UPDATE ON public.listings
  FOR EACH ROW
  WHEN (OLD.price IS DISTINCT FROM NEW.price)
  EXECUTE FUNCTION track_listing_price_change();

-- Grant permissions
GRANT SELECT ON public.listing_price_history TO authenticated;
GRANT INSERT ON public.listing_price_history TO authenticated;
