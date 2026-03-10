-- P6.3 — Fraud Detection Engine
-- Creates fraud_flags table used by the server-side rules engine.

CREATE TABLE IF NOT EXISTS fraud_flags (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  rule_id         TEXT        NOT NULL,
  severity        TEXT        NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  description     TEXT        NOT NULL,
  metadata        JSONB       DEFAULT '{}',
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID        REFERENCES profiles(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS fraud_flags_user_id_idx   ON fraud_flags(user_id);
CREATE INDEX IF NOT EXISTS fraud_flags_status_idx    ON fraud_flags(status);
CREATE INDEX IF NOT EXISTS fraud_flags_rule_id_idx   ON fraud_flags(rule_id);
CREATE INDEX IF NOT EXISTS fraud_flags_severity_idx  ON fraud_flags(severity);

-- RLS
ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;

-- Only service role (server actions) can read/write — admins call via service client
CREATE POLICY "Service role full access to fraud_flags"
  ON fraud_flags FOR ALL
  USING (true)
  WITH CHECK (true);
