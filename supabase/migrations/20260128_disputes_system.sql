-- ============================================
-- DISPUTES SYSTEM
-- ============================================

-- Dispute Status Enum
DO $$ BEGIN
  CREATE TYPE dispute_status_enum AS ENUM (
    'open',
    'under_review',
    'awaiting_seller_response',
    'awaiting_buyer_response',
    'escalated',
    'resolved_buyer_favor',
    'resolved_seller_favor',
    'resolved_partial',
    'closed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Dispute Reason Enum
DO $$ BEGIN
  CREATE TYPE dispute_reason_enum AS ENUM (
    'item_not_received',
    'not_as_described',
    'wrong_item',
    'partial_delivery',
    'quality_issue',
    'account_issue',
    'unauthorized_transaction',
    'seller_unresponsive',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- DISPUTES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Transaction reference
  transaction_id UUID,
  order_reference TEXT,

  -- Parties
  buyer_id UUID REFERENCES public.profiles(id) NOT NULL,
  seller_id UUID REFERENCES public.profiles(id) NOT NULL,

  -- Dispute details
  reason dispute_reason_enum NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Evidence
  evidence_urls TEXT[] DEFAULT '{}',

  -- Financial
  disputed_amount DECIMAL(10, 2) NOT NULL,
  resolved_amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',

  -- Status
  status dispute_status_enum DEFAULT 'open' NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',

  -- Assignment
  assigned_to UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ,

  -- Resolution
  resolution_type TEXT CHECK (resolution_type IN ('refund_full', 'refund_partial', 'no_refund', 'replacement', 'other')),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,

  -- Escalation
  escalated_at TIMESTAMPTZ,
  escalated_by UUID REFERENCES public.profiles(id),
  escalation_reason TEXT,

  -- SLA tracking
  first_response_at TIMESTAMPTZ,
  first_response_deadline TIMESTAMPTZ,
  resolution_deadline TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Users can view their own disputes
CREATE POLICY "Users can view own disputes"
  ON disputes FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Users can create disputes as buyer
CREATE POLICY "Buyers can create disputes"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

-- Admins can view all disputes
CREATE POLICY "Admins can view all disputes"
  ON disputes FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can update disputes
CREATE POLICY "Admins can update disputes"
  ON disputes FOR UPDATE
  TO authenticated
  USING (public.has_permission('disputes.resolve'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_disputes_buyer_id ON disputes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_seller_id ON disputes(seller_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_assigned_to ON disputes(assigned_to);
CREATE INDEX IF NOT EXISTS idx_disputes_priority ON disputes(priority);
CREATE INDEX IF NOT EXISTS idx_disputes_created_at ON disputes(created_at DESC);

-- ============================================
-- DISPUTE MESSAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.dispute_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dispute_id UUID REFERENCES public.disputes(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) NOT NULL,

  -- Message content
  message TEXT NOT NULL,

  -- Attachments
  attachments JSONB DEFAULT '[]',

  -- Internal note flag (only visible to admins)
  is_internal BOOLEAN DEFAULT false,

  -- System message flag
  is_system_message BOOLEAN DEFAULT false,

  -- Read tracking
  read_by_buyer BOOLEAN DEFAULT false,
  read_by_seller BOOLEAN DEFAULT false,
  read_by_admin BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

-- Users can view non-internal messages on their disputes
CREATE POLICY "Users can view dispute messages"
  ON dispute_messages FOR SELECT
  TO authenticated
  USING (
    NOT is_internal AND
    EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.id = dispute_id
      AND (d.buyer_id = auth.uid() OR d.seller_id = auth.uid())
    )
  );

-- Users can send messages on their disputes
CREATE POLICY "Users can send dispute messages"
  ON dispute_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT is_internal AND
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.id = dispute_id
      AND (d.buyer_id = auth.uid() OR d.seller_id = auth.uid())
    )
  );

-- Admins can view all messages including internal
CREATE POLICY "Admins can view all dispute messages"
  ON dispute_messages FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can send messages
CREATE POLICY "Admins can send dispute messages"
  ON dispute_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_admin());

-- Admins can update messages
CREATE POLICY "Admins can update dispute messages"
  ON dispute_messages FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute_id ON dispute_messages(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_sender_id ON dispute_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_created_at ON dispute_messages(created_at);

-- ============================================
-- DISPUTES VIEW
-- ============================================

CREATE OR REPLACE VIEW disputes_with_users AS
SELECT
  d.*,
  bp.username as buyer_username,
  bp.full_name as buyer_name,
  bp.avatar_url as buyer_avatar,
  bp.email as buyer_email,
  sp.username as seller_username,
  sp.full_name as seller_name,
  sp.avatar_url as seller_avatar,
  sp.email as seller_email,
  ap.username as assigned_admin_username,
  ap.full_name as assigned_admin_name,
  (SELECT COUNT(*) FROM dispute_messages WHERE dispute_id = d.id) as message_count,
  (SELECT COUNT(*) FROM dispute_messages WHERE dispute_id = d.id AND is_internal = false) as public_message_count
FROM disputes d
JOIN profiles bp ON d.buyer_id = bp.id
JOIN profiles sp ON d.seller_id = sp.id
LEFT JOIN profiles ap ON d.assigned_to = ap.id;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update disputes updated_at
CREATE OR REPLACE FUNCTION update_disputes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_disputes_updated_at ON disputes;
CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_disputes_updated_at();

-- Auto-set deadlines
CREATE OR REPLACE FUNCTION set_dispute_deadlines()
RETURNS TRIGGER AS $$
BEGIN
  NEW.first_response_deadline = NEW.created_at + INTERVAL '48 hours';
  NEW.resolution_deadline = NEW.created_at + INTERVAL '7 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_dispute_deadlines ON disputes;
CREATE TRIGGER set_dispute_deadlines
  BEFORE INSERT ON disputes
  FOR EACH ROW
  EXECUTE FUNCTION set_dispute_deadlines();
