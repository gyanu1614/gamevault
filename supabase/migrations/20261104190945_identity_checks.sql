-- A seller can get verified without an old-style application (plan 2, phase 1).
--
-- profiles.is_verified is the one flag: it draws the blue check and opens the withdrawal gate.
-- Until now only approving a seller application set it, so everyone who joined through /founding
-- could earn money and never withdraw it, while the wallet said "Verification opens in your
-- wallet soon". Sellers still list and sell with no ID check. This only adds the way through.
--
--   · identity_checks: one row per provider session, so a result can be matched to the seller who
--     started it. Service role only.
--   · identity_check_record: the one writer of a result. The check and the profile change together
--     or not at all. Callers re-read the decision from the provider first, so this is never
--     driven by a webhook body alone.
--   · The gate's refusal no longer promises a feature "soon".
--   · The `profile` live event now carries is_verified, so the blue check appears without a reload.

CREATE TABLE IF NOT EXISTS public.identity_checks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id  text NOT NULL UNIQUE,
  session_url text,
  status      text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'in_review', 'approved', 'declined')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  decided_at  timestamptz,
  approved_at timestamptz
);
CREATE INDEX IF NOT EXISTS identity_checks_user_created_idx ON public.identity_checks (user_id, created_at DESC);

ALTER TABLE public.identity_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.identity_checks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.identity_checks TO service_role;

CREATE OR REPLACE FUNCTION public.identity_check_record(p_session text, p_status text) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_check public.identity_checks%ROWTYPE;
  v_was   boolean;
BEGIN
  IF p_status NOT IN ('in_review', 'approved', 'declined') THEN
    RAISE EXCEPTION 'identity_check_record: unknown status %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_check FROM public.identity_checks WHERE session_id = p_session FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('recorded', false);
  END IF;

  PERFORM set_config('app.guarded_write', 'on', true);
  SELECT is_verified INTO v_was FROM public.profiles WHERE id = v_check.user_id FOR UPDATE;

  UPDATE public.identity_checks
  SET status = p_status,
      decided_at = now(),
      approved_at = CASE p_status WHEN 'approved' THEN now() WHEN 'declined' THEN NULL ELSE approved_at END
  WHERE id = v_check.id;

  IF p_status = 'approved' THEN
    UPDATE public.profiles
    SET is_verified = true, kyc_status = 'approved', kyc_submitted_at = COALESCE(kyc_submitted_at, v_check.created_at)
    WHERE id = v_check.user_id;
  ELSIF p_status = 'declined' AND v_check.approved_at IS NOT NULL THEN
    -- The provider reversed its own approval, possibly after a review step.
    UPDATE public.profiles SET is_verified = false, kyc_status = 'rejected' WHERE id = v_check.user_id;
  ELSIF COALESCE(v_was, false) IS NOT TRUE THEN
    -- A seller verified another way keeps their standing whatever this check says.
    UPDATE public.profiles
    SET kyc_status = CASE p_status WHEN 'declined' THEN 'rejected' ELSE 'pending' END,
        kyc_submitted_at = COALESCE(kyc_submitted_at, v_check.created_at)
    WHERE id = v_check.user_id;
  END IF;

  RETURN jsonb_build_object(
    'recorded', true,
    'user_id', v_check.user_id,
    'status', p_status,
    'newly_verified', p_status = 'approved' AND COALESCE(v_was, false) IS NOT TRUE
  );
END;
$$;
REVOKE ALL ON FUNCTION public.identity_check_record(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.identity_check_record(text, text) TO service_role;

-- Body from 20261008021902 with the refusal message corrected.
CREATE OR REPLACE FUNCTION public.seller_withdrawal_gate(p_seller_id uuid) RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role     TEXT;
  v_verified BOOLEAN;
  v_since    TIMESTAMPTZ;
  v_days     INT;
  v_freeze   INT;
  v_unlock   TIMESTAMPTZ;
  v_changed  TIMESTAMPTZ;
  v_until    TIMESTAMPTZ;
BEGIN
  SELECT role, is_verified INTO v_role, v_verified FROM profiles WHERE id = p_seller_id;
  IF v_role IS DISTINCT FROM 'seller' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_a_seller', 'seller_since', NULL,
                              'unlock_at', NULL, 'min_age_days', NULL, 'freeze_until', NULL);
  END IF;
  -- KYC first. An unverified seller (open signup) cannot withdraw at all.
  IF COALESCE(v_verified, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'kyc_required', 'seller_since', NULL,
                              'unlock_at', NULL, 'min_age_days', NULL, 'freeze_until', NULL,
                              'message', 'Verify your identity before your first withdrawal. Your balance stays here until then.');
  END IF;
  v_since := seller_since(p_seller_id);
  SELECT withdrawal_min_account_age_days, payout_details_freeze_hours INTO v_days, v_freeze FROM platform_fee_settings WHERE id;
  v_unlock := COALESCE(v_since, now()) + make_interval(days => COALESCE(v_days, 30));
  SELECT details_changed_at INTO v_changed FROM seller_payout_details WHERE seller_id = p_seller_id;
  v_until := CASE WHEN v_changed IS NULL THEN NULL ELSE v_changed + make_interval(hours => COALESCE(v_freeze, 48)) END;

  IF v_since IS NULL OR v_unlock > now() THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'account_age', 'seller_since', v_since,
                              'unlock_at', v_unlock, 'min_age_days', v_days, 'freeze_until', v_until);
  END IF;
  IF v_until IS NOT NULL AND v_until > now() THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'payout_details_freeze', 'seller_since', v_since,
                              'unlock_at', v_unlock, 'min_age_days', v_days, 'freeze_until', v_until, 'freeze_hours', v_freeze);
  END IF;
  RETURN jsonb_build_object('eligible', true, 'reason', NULL, 'seller_since', v_since, 'unlock_at', v_unlock,
                            'min_age_days', v_days, 'freeze_until', v_until);
END;
$$;
REVOKE ALL ON FUNCTION public.seller_withdrawal_gate(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_withdrawal_gate(uuid) TO service_role;

-- Live profile event: body from 20261102161908 plus is_verified.
CREATE OR REPLACE FUNCTION public.user_channel_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.user_channel_send(
    new.id,
    'profile',
    jsonb_build_object(
      'role', new.role,
      'shop_name', new.shop_name,
      'shop_slug', new.shop_slug,
      'username', new.username,
      'avatar_url', new.avatar_url,
      'badges', new.badges,
      'seller_tier', new.seller_tier,
      'seller_status', new.seller_status,
      'full_name', new.full_name,
      'is_verified', new.is_verified
    )
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS profiles_user_channel ON public.profiles;
CREATE TRIGGER profiles_user_channel
  AFTER UPDATE OF role, shop_name, shop_slug, username, avatar_url, badges, seller_tier, seller_status, full_name, is_verified
  ON public.profiles
  FOR EACH ROW
  WHEN (
    (new.role, new.shop_name, new.shop_slug, new.username, new.avatar_url, new.badges, new.seller_tier, new.seller_status, new.full_name, new.is_verified)
    IS DISTINCT FROM
    (old.role, old.shop_name, old.shop_slug, old.username, old.avatar_url, old.badges, old.seller_tier, old.seller_status, old.full_name, old.is_verified)
  )
  EXECUTE FUNCTION public.user_channel_on_profile();
