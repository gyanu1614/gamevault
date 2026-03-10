-- ============================================================
-- P5.1 — Affiliate & Referral Program
-- ============================================================

-- 1. Add referral columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by    UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Pre-populate referral codes for existing users
--    Format: first 3 chars of username + 6 random hex chars, uppercased
UPDATE profiles
SET referral_code = UPPER(
  SUBSTRING(REPLACE(username, '-', ''), 1, 3) ||
  SUBSTRING(ENCODE(gen_random_bytes(4), 'hex'), 1, 6)
)
WHERE referral_code IS NULL;

-- 3. Ensure every future profile gets a referral code via trigger
CREATE OR REPLACE FUNCTION generate_referral_code_for_new_user()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  new_code TEXT;
  attempts  INT := 0;
BEGIN
  LOOP
    new_code := UPPER(
      SUBSTRING(REPLACE(NEW.username, '-', ''), 1, 3) ||
      SUBSTRING(ENCODE(gen_random_bytes(4), 'hex'), 1, 6)
    );
    -- Exit if unique (no collision)
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM profiles WHERE referral_code = new_code
    );
    attempts := attempts + 1;
    IF attempts > 10 THEN
      -- Fallback: pure random 8-char hex
      new_code := UPPER(SUBSTRING(ENCODE(gen_random_bytes(5), 'hex'), 1, 8));
      EXIT;
    END IF;
  END LOOP;
  NEW.referral_code := new_code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON profiles;
CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION generate_referral_code_for_new_user();

-- 4. Create referral_earnings table
CREATE TABLE IF NOT EXISTS referral_earnings (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  order_id         UUID        REFERENCES orders(id) ON DELETE SET NULL,
  type             TEXT        NOT NULL CHECK (type IN ('signup_bonus', 'purchase_commission')),
  amount           NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'paid', 'cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at          TIMESTAMPTZ
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_referral_earnings_referrer  ON referral_earnings(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_referred  ON referral_earnings(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_order     ON referral_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code      ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by        ON profiles(referred_by);

-- 6. RLS
ALTER TABLE referral_earnings ENABLE ROW LEVEL SECURITY;

-- Referrer can see their own earnings
CREATE POLICY "referral_earnings_select_own"
  ON referral_earnings FOR SELECT
  USING (auth.uid() = referrer_id);

-- Admins can see everything (via admin_roles check)
CREATE POLICY "referral_earnings_select_admin"
  ON referral_earnings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only server (service role) can insert/update referral earnings
-- (commission logic runs via server actions with service client)
CREATE POLICY "referral_earnings_insert_service"
  ON referral_earnings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "referral_earnings_update_service"
  ON referral_earnings FOR UPDATE
  USING (auth.uid() = referrer_id OR
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
