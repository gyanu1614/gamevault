-- P6.5 — GDPR Data Requests
-- Tracks user-initiated data export and deletion requests.

CREATE TABLE IF NOT EXISTS gdpr_requests (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL CHECK (type IN ('export', 'deletion')),
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  requested_at    TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  processed_by    UUID        REFERENCES profiles(id),
  rejection_reason TEXT,
  -- For exports: signed URL or JSON blob reference
  export_url      TEXT,
  -- Notes for audit trail
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS gdpr_requests_user_id_idx ON gdpr_requests(user_id);
CREATE INDEX IF NOT EXISTS gdpr_requests_status_idx  ON gdpr_requests(status);
CREATE INDEX IF NOT EXISTS gdpr_requests_type_idx    ON gdpr_requests(type);

-- RLS
ALTER TABLE gdpr_requests ENABLE ROW LEVEL SECURITY;

-- Users can see and insert their own requests
CREATE POLICY "Users can view own gdpr requests"
  ON gdpr_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can submit gdpr requests"
  ON gdpr_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role full access to gdpr_requests"
  ON gdpr_requests FOR ALL
  USING (true)
  WITH CHECK (true);
