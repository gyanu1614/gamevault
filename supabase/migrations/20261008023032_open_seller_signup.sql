-- Open seller signup (2026-10-08): list first, verify identity at withdrawal.
--
-- /founding becomes a 4-step flow (sign in → details → store → agreement) that
-- makes the account an UNVERIFIED seller straight away. This migration is its
-- data layer. Everything here is additive and service-role only; the payout
-- side (kyc_required) landed in 20261008021902_payout_kyc_gate.
--
--   1. seller_onboarding   — one row per user: the step data and progress.
--   2. seller_agreements   — append-only e-signatures: agreement version, a
--                            hash of the text they saw, typed name, the drawn
--                            signature (file in the private bucket), IP, UA.
--   3. seller-signatures   — PRIVATE bucket for the signature PNGs. Owner may
--                            read their own; writes are service-role only.
--   4. Review threshold    — an unverified seller's listing priced above
--                            unverified_review_price_usd() (= the TS constant
--                            UNVERIFIED_REVIEW_PRICE_USD) is held for review:
--                            check_listing_moderation gains that rule. No
--                            listing-count cap for unverified sellers.
--   5. seller_onboarding_complete(user, version) — the ONE write that turns a
--                            buyer into a seller: refuses until details, store
--                            and a signature for the CURRENT agreement version
--                            exist; then role=seller, active, entry rank,
--                            is_verified stays false, unique shop slug, and
--                            the founding programme while spots remain
--                            (founding_spot_cap() = FOUNDING_SPOT_CAP).
--
-- Rollout: push before the deploy (nothing live reads these yet; the trigger
-- change only ever HOLDS a listing, never frees one).

-- ── 1. seller_onboarding ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seller_onboarding (
  user_id               uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- step 2
  country               text,
  sells                 jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ game, categories[] }]
  discord               text,
  is_adult_confirmed_at timestamptz,
  -- step 3
  store_name            text,
  logo_uploaded_at      timestamptz,
  -- bookkeeping
  source                text,                                  -- banner / footer / nav …
  current_step          smallint NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 4),
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_onboarding_store_name_len CHECK (store_name IS NULL OR (length(store_name) BETWEEN 3 AND 50)),
  CONSTRAINT seller_onboarding_discord_len    CHECK (discord IS NULL OR length(discord) <= 64),
  CONSTRAINT seller_onboarding_country_len    CHECK (country IS NULL OR length(country) BETWEEN 2 AND 64),
  CONSTRAINT seller_onboarding_sells_array    CHECK (jsonb_typeof(sells) = 'array')
);
COMMENT ON TABLE public.seller_onboarding IS
  'Open seller signup (/founding): per-user step data + progress. Service-role only; server actions scope reads/writes to the session user. completed_at is set by seller_onboarding_complete().';

ALTER TABLE public.seller_onboarding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.seller_onboarding FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.seller_onboarding TO service_role;

-- ── 2. seller_agreements ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seller_agreements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agreement_slug    text NOT NULL DEFAULT 'seller-agreement',
  agreement_version text NOT NULL,
  agreement_sha256  text NOT NULL CHECK (agreement_sha256 ~ '^[0-9a-f]{64}$'),
  typed_name        text NOT NULL CHECK (length(typed_name) BETWEEN 2 AND 120),
  signature_path    text NOT NULL CHECK (length(signature_path) BETWEEN 1 AND 300),
  ip                inet,
  user_agent        text,
  signed_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.seller_agreements IS
  'Seller Agency Agreement e-signatures (open seller signup). Append-only evidence: which version + text hash they signed, typed name, drawn signature file (bucket seller-signatures), IP and UA. Service-role only.';
CREATE INDEX IF NOT EXISTS idx_seller_agreements_user ON public.seller_agreements (user_id, signed_at DESC);

ALTER TABLE public.seller_agreements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.seller_agreements FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.seller_agreements TO service_role;

-- ── 3. seller-signatures bucket (PRIVATE) ───────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('seller-signatures', 'seller-signatures', false, 262144, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path is `{user_id}/{agreement_id}.png`; the owner may read their own copy
-- (future "download my agreement"). No write policy: the service role writes.
DROP POLICY IF EXISTS seller_signatures_owner_read ON storage.objects;
CREATE POLICY seller_signatures_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'seller-signatures' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── 4. Review threshold + moderation trigger ────────────────────────────────
-- Mirrors src/lib/fees UNVERIFIED_REVIEW_PRICE_USD (guard test pins equality).
CREATE OR REPLACE FUNCTION public.unverified_review_price_usd() RETURNS numeric
  LANGUAGE sql IMMUTABLE AS $$ SELECT 100::numeric $$;
REVOKE ALL ON FUNCTION public.unverified_review_price_usd() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unverified_review_price_usd() TO service_role;

-- Mirrors src/lib/config/founding-seller FOUNDING_SPOT_CAP (guard test pins equality).
CREATE OR REPLACE FUNCTION public.founding_spot_cap() RETURNS integer
  LANGUAGE sql IMMUTABLE AS $$ SELECT 100 $$;
REVOKE ALL ON FUNCTION public.founding_spot_cap() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.founding_spot_cap() TO service_role;

-- Body from the baseline (approved_by short-circuit + tier pre-moderation)
-- plus the open-signup price rule. SECURITY DEFINER so a JWT insert can call
-- the service-role-only helpers above; trigger order is unchanged.
--
-- The price rule runs BEFORE the approved_by short-circuit. Security review
-- 2026-10-08: approve_listing stamps approved_by on every admin-approved row
-- and seller edits never clear it, so a rule placed after the short-circuit
-- never saw an inline price raise on an approved row ($5 → $5,000, live). Now:
--   · skipped only for the moderation RPCs (app.guarded_write = 'on'), so an
--     admin approving a $5,000 listing is never bounced;
--   · for an UNVERIFIED seller, a price raise over the line on an approved
--     row (any status) voids the approval (approved_by/approved_at → NULL) and,
--     if the row is live, holds it; going live with no approval over the line
--     holds it too. A draft re-priced to $5,000 therefore cannot be activated
--     later without review.
--   · unpause / restock WITHOUT a price change keeps the admin's approval and
--     is not touched (owner rule).
CREATE OR REPLACE FUNCTION public.check_listing_moderation() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unverified   boolean;
  v_flagged      boolean := COALESCE(current_setting('app.guarded_write', true), '') = 'on';
  v_price_change boolean := TG_OP = 'UPDATE' AND NEW.price IS DISTINCT FROM OLD.price;
  v_going_live   boolean := NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active');
BEGIN
  -- Open seller signup: an UNVERIFIED seller's listing priced above the review
  -- line is reviewed. Evaluated first so an admin-approved row cannot slip past
  -- via the approved_by short-circuit below. Moderation RPCs are exempt.
  IF NOT v_flagged
     AND NEW.price IS NOT NULL
     AND NEW.price > unverified_review_price_usd()
     AND (TG_OP = 'INSERT' OR v_price_change OR (v_going_live AND NEW.approved_by IS NULL)) THEN
    SELECT COALESCE(is_verified, false) IS NOT TRUE INTO v_unverified FROM profiles WHERE id = NEW.seller_id;
    IF COALESCE(v_unverified, true) THEN
      IF v_price_change AND NEW.approved_by IS NOT NULL THEN
        -- The approval covered the old price, not this one.
        NEW.approved_by := NULL;
        NEW.approved_at := NULL;
      END IF;
      IF NEW.status = 'active' THEN
        NEW.status := 'pending_approval';
      END IF;
    END IF;
  END IF;

  -- An admin approval (approved_by set) passes untouched — the moderation RPCs
  -- are the only way a reviewed listing becomes active again.
  IF NEW.approved_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tier pre-moderation: the entry rank's first N listings are reviewed.
  IF v_going_live AND NEW.status = 'active' THEN
    IF check_seller_needs_moderation(NEW.seller_id) THEN
      NEW.status = 'pending_approval';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.check_listing_moderation() FROM PUBLIC, anon, authenticated;

-- ── 5. seller_onboarding_complete ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seller_onboarding_complete(p_user uuid, p_agreement_version text) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prof     RECORD;
  v_ob       RECORD;
  v_tier     text;
  v_slug     text;
  v_founding boolean;
  v_now      timestamptz := now();
BEGIN
  PERFORM set_config('app.guarded_write', 'on', true);
  PERFORM pg_advisory_xact_lock(hashtextextended('seller_onboarding_complete:' || p_user::text, 0));

  SELECT id, role, shop_slug, founding_seller, founding_since, is_verified
    INTO v_prof FROM profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('completed', false, 'reason', 'no_profile'); END IF;

  -- Already a seller: nothing to flip. Stamp completion and report.
  IF v_prof.role = 'seller' THEN
    UPDATE seller_onboarding SET completed_at = COALESCE(completed_at, v_now), updated_at = v_now WHERE user_id = p_user;
    RETURN jsonb_build_object('completed', true, 'already', true, 'shop_slug', v_prof.shop_slug);
  END IF;
  -- Staff accounts keep their role; they publish through the admin path.
  IF v_prof.role IN ('admin', 'moderator', 'support', 'super_admin') THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'staff_account');
  END IF;

  SELECT * INTO v_ob FROM seller_onboarding WHERE user_id = p_user;
  IF NOT FOUND THEN RETURN jsonb_build_object('completed', false, 'reason', 'no_onboarding'); END IF;
  IF v_ob.country IS NULL OR v_ob.is_adult_confirmed_at IS NULL OR jsonb_array_length(v_ob.sells) = 0 THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'details_incomplete');
  END IF;
  IF v_ob.store_name IS NULL THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'store_incomplete');
  END IF;
  IF p_agreement_version IS NULL OR NOT EXISTS (
    SELECT 1 FROM seller_agreements WHERE user_id = p_user AND agreement_version = p_agreement_version
  ) THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'agreement_missing');
  END IF;
  -- Store names are unique ignoring case (the slug is unique by constraint).
  IF EXISTS (SELECT 1 FROM profiles WHERE id <> p_user AND lower(shop_name) = lower(v_ob.store_name)) THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'store_name_taken');
  END IF;

  v_slug := generate_shop_slug(v_ob.store_name);
  SELECT tier INTO v_tier FROM seller_tier_config ORDER BY sort_order ASC NULLS LAST, tier ASC LIMIT 1;
  -- Founding programme: granted while spots remain ("first 100").
  v_founding := COALESCE(v_prof.founding_seller, false)
                OR (SELECT count(*) FROM profiles WHERE founding_seller) < founding_spot_cap();

  UPDATE profiles SET
    role                  = 'seller',
    seller_status         = 'active',
    seller_tier           = v_tier,
    is_verified           = COALESCE(is_verified, false),   -- never set here; KYC at withdrawal does
    shop_name             = v_ob.store_name,
    shop_slug             = v_slug,
    shop_name_updated_at  = v_now,
    founding_seller       = v_founding,
    founding_since        = CASE WHEN v_founding THEN COALESCE(founding_since, v_now) ELSE founding_since END,
    updated_at            = v_now
  WHERE id = p_user;

  UPDATE seller_onboarding SET completed_at = v_now, current_step = 4, updated_at = v_now WHERE user_id = p_user;

  RETURN jsonb_build_object('completed', true, 'already', false, 'shop_slug', v_slug, 'tier', v_tier, 'founding', v_founding);
END;
$$;
REVOKE ALL ON FUNCTION public.seller_onboarding_complete(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_onboarding_complete(uuid, text) TO service_role;

-- Probe for integration tests.
CREATE OR REPLACE FUNCTION public.open_seller_signup_version() RETURNS integer
  LANGUAGE sql IMMUTABLE AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.open_seller_signup_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_seller_signup_version() TO service_role;

-- ── 6. Proof — refuse to finish half-applied ────────────────────────────────
DO $$
DECLARE v_bad text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'seller-signatures' AND NOT public) THEN
    RAISE EXCEPTION 'open_seller_signup: bucket seller-signatures missing or public';
  END IF;
  SELECT string_agg(p.polname, ', ') INTO v_bad
    FROM pg_policy p
   WHERE p.polrelid = 'storage.objects'::regclass
     AND p.polcmd <> 'r'
     AND pg_get_expr(COALESCE(p.polqual, p.polwithcheck), p.polrelid) LIKE '%seller-signatures%';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'open_seller_signup: unexpected write policy on seller-signatures: %', v_bad;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.seller_onboarding'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.seller_agreements'::regclass) THEN
    RAISE EXCEPTION 'open_seller_signup: RLS not enabled on the new tables';
  END IF;
  IF has_function_privilege('authenticated', 'public.seller_onboarding_complete(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'open_seller_signup: seller_onboarding_complete is callable by authenticated';
  END IF;
END $$;
