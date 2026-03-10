-- Create dispute_resolutions table to track resolution details
-- This allows proper tracking of dispute outcomes and financial transactions

CREATE TABLE IF NOT EXISTS public.dispute_resolutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id UUID REFERENCES public.disputes(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Resolution details
  resolved_by UUID REFERENCES public.profiles(id) NOT NULL,
  resolution_type TEXT NOT NULL CHECK (resolution_type IN (
    'refund_buyer',           -- Full refund to buyer
    'release_seller',         -- Release funds to seller
    'partial_refund',         -- Partial refund (split)
    'replacement',            -- Item replacement
    'other'                   -- Custom resolution
  )),

  -- Who won the dispute
  favored_party TEXT NOT NULL CHECK (favored_party IN ('buyer', 'seller', 'neutral')),

  -- Financial details
  refund_amount NUMERIC(10, 2),
  refund_percentage NUMERIC(5, 2),  -- If partial refund
  seller_payout_amount NUMERIC(10, 2),

  -- Notes
  resolution_notes TEXT,  -- Visible to both parties
  admin_notes TEXT,       -- Internal notes, only visible to admins

  -- Timestamps
  resolved_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.dispute_resolutions ENABLE ROW LEVEL SECURITY;

-- Users can view resolutions for their disputes
CREATE POLICY "Users can view own dispute resolutions"
  ON dispute_resolutions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.id = dispute_id
      AND (d.buyer_id = auth.uid() OR d.seller_id = auth.uid())
    )
  );

-- Admins can view all resolutions
CREATE POLICY "Admins can view all dispute resolutions"
  ON dispute_resolutions FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can create resolutions
CREATE POLICY "Admins can create dispute resolutions"
  ON dispute_resolutions FOR INSERT
  TO authenticated
  WITH CHECK (
    resolved_by = auth.uid() AND
    public.has_permission('disputes.resolve')
  );

-- Admins can update resolutions (for corrections/changes)
CREATE POLICY "Admins can update dispute resolutions"
  ON dispute_resolutions FOR UPDATE
  TO authenticated
  USING (public.has_permission('disputes.resolve'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dispute_resolutions_dispute_id ON dispute_resolutions(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_resolutions_resolved_by ON dispute_resolutions(resolved_by);
CREATE INDEX IF NOT EXISTS idx_dispute_resolutions_resolved_at ON dispute_resolutions(resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispute_resolutions_favored_party ON dispute_resolutions(favored_party);

-- Add comment
COMMENT ON TABLE dispute_resolutions IS 'Stores resolution details for disputes including financial outcomes';
