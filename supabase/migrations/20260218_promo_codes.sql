-- P5.3 — Promo Code System
-- Creates promo_codes and promo_code_usages tables; extends orders table

-- ── Promo codes ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id               UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code             TEXT          NOT NULL UNIQUE,
  type             TEXT          NOT NULL CHECK (type IN ('percentage', 'flat')),
  value            NUMERIC(10,2) NOT NULL CHECK (value > 0),  -- % or $ amount
  description      TEXT          NOT NULL DEFAULT '',
  min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_discount     NUMERIC(10,2),    -- cap for percentage codes (NULL = uncapped)
  usage_limit      INTEGER,          -- NULL = unlimited total uses
  per_user_limit   INTEGER NOT NULL DEFAULT 1,
  total_used       INTEGER NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique index so SUMMER20 == summer20
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_lower_idx ON promo_codes(LOWER(code));
CREATE INDEX IF NOT EXISTS promo_codes_is_active_idx ON promo_codes(is_active);

-- ── Usage ledger ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_code_usages (
  id              UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id   UUID          NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id         UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  order_id        UUID          REFERENCES orders(id)   ON DELETE SET NULL,
  discount_amount NUMERIC(10,2) NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS promo_code_usages_promo_code_id_idx ON promo_code_usages(promo_code_id);
CREATE INDEX IF NOT EXISTS promo_code_usages_user_id_idx       ON promo_code_usages(user_id);
CREATE INDEX IF NOT EXISTS promo_code_usages_order_id_idx      ON promo_code_usages(order_id);

-- ── Extend orders ─────────────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promo_code_id  UUID          REFERENCES promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_discount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- ── RLS — promo_codes ─────────────────────────────────────────────────────────
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active codes (needed for checkout validation)
CREATE POLICY "promo_codes_select_active"
  ON promo_codes FOR SELECT
  USING (is_active = true);

-- Admins have full access
CREATE POLICY "promo_codes_admin_all"
  ON promo_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ── RLS — promo_code_usages ───────────────────────────────────────────────────
ALTER TABLE promo_code_usages ENABLE ROW LEVEL SECURITY;

-- Users see their own usages
CREATE POLICY "promo_code_usages_select_own"
  ON promo_code_usages FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own usages (server action runs as user session)
CREATE POLICY "promo_code_usages_insert_own"
  ON promo_code_usages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins read all
CREATE POLICY "promo_code_usages_admin_select"
  ON promo_code_usages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
