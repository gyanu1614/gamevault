-- P6.4 — INFORM Consumers Act Compliance
--
-- Sellers who exceed the statutory thresholds (200+ transactions OR $5,000+ gross
-- in a 12-month period) must supply verifiable identity & contact information to
-- the marketplace operator.
--
-- This table stores the seller-submitted disclosure and admin certification status.

CREATE TABLE IF NOT EXISTS inform_disclosures (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Identity
  legal_name        TEXT        NOT NULL,
  address_line1     TEXT        NOT NULL,
  address_line2     TEXT,
  city              TEXT        NOT NULL,
  state_province    TEXT        NOT NULL,
  postal_code       TEXT        NOT NULL,
  country           TEXT        NOT NULL DEFAULT 'US',

  -- Financial identifiers (store obfuscated/last-4 only — never full numbers)
  tax_id_last4      TEXT        NOT NULL,   -- EIN or SSN last 4 digits
  bank_last4        TEXT,                   -- Bank account last 4 (optional if Stripe Connect active)

  -- Public contact (shown to buyers on request per Act §2(a)(3))
  contact_email     TEXT        NOT NULL,
  contact_phone     TEXT        NOT NULL,

  -- Consent & terms
  consented_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_ip        TEXT,                   -- IP at time of consent (store for compliance)

  -- Lifecycle
  status            TEXT        NOT NULL DEFAULT 'submitted'
                                CHECK (status IN ('submitted', 'certified', 'rejected', 'needs_update')),
  submitted_at      TIMESTAMPTZ DEFAULT now(),
  certified_at      TIMESTAMPTZ,
  certified_by      UUID        REFERENCES profiles(id),
  rejection_reason  TEXT,

  -- Versioning — keep all historical records
  version           INTEGER     NOT NULL DEFAULT 1,
  superseded_by     UUID        REFERENCES inform_disclosures(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS inform_disclosures_seller_id_idx ON inform_disclosures(seller_id);
CREATE INDEX IF NOT EXISTS inform_disclosures_status_idx    ON inform_disclosures(status);

-- Mark sellers who need to submit: add column to profiles for quick lookup
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS inform_status TEXT DEFAULT 'not_required'
    CHECK (inform_status IN ('not_required', 'required', 'submitted', 'certified', 'rejected'));

-- RLS
ALTER TABLE inform_disclosures ENABLE ROW LEVEL SECURITY;

-- Sellers can read their own disclosures
CREATE POLICY "Sellers can view own inform disclosures"
  ON inform_disclosures FOR SELECT
  USING (auth.uid() = seller_id);

-- Sellers can insert their own disclosures
CREATE POLICY "Sellers can submit inform disclosures"
  ON inform_disclosures FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

-- Service role can do anything (admin operations)
CREATE POLICY "Service role full access to inform_disclosures"
  ON inform_disclosures FOR ALL
  USING (true)
  WITH CHECK (true);
