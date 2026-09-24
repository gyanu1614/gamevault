-- ============================================================================
-- Fee engine PR 7, Part 5 — seller notice sends (at-most-once).
-- Idempotent: safe to re-run.
--
-- One row per (notice_key, seller). The claim is taken BEFORE the email is
-- handed to the provider, so a crash, a retry or a second admin click can
-- never send the same notice to the same seller twice. A provider failure is
-- recorded on the row (error) and stays claimed — re-sending is a deliberate
-- admin action (delete the row), never an automatic retry.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.seller_notice_sends (
  notice_key   text NOT NULL,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email        text NOT NULL,
  claimed_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz,
  provider_id  text,
  error        text,
  claimed_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (notice_key, user_id)
);
COMMENT ON TABLE public.seller_notice_sends IS
  'At-most-once ledger for admin-sent seller notices (e.g. the fee schedule notice). Claim first, send second. Service-role only.';
ALTER TABLE public.seller_notice_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.seller_notice_sends FROM PUBLIC, anon, authenticated;

-- Returns true exactly once per (key, user): the caller may send.
CREATE OR REPLACE FUNCTION public.seller_notice_claim(p_notice_key text, p_user_id uuid, p_email text, p_claimed_by uuid DEFAULT NULL)
  RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_claimed BOOLEAN := false;
BEGIN
  IF COALESCE(length(p_notice_key), 0) = 0 OR p_user_id IS NULL OR COALESCE(length(p_email), 0) = 0 THEN
    RAISE EXCEPTION 'seller_notice_claim: key, user and email are required' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO seller_notice_sends (notice_key, user_id, email, claimed_by)
  VALUES (p_notice_key, p_user_id, lower(p_email), p_claimed_by)
  ON CONFLICT (notice_key, user_id) DO NOTHING;
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  RETURN v_claimed;
END;
$$;
REVOKE ALL ON FUNCTION public.seller_notice_claim(text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_notice_claim(text, uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.seller_notice_record(p_notice_key text, p_user_id uuid, p_provider_id text, p_error text)
  RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE seller_notice_sends
     SET sent_at = CASE WHEN p_error IS NULL THEN now() ELSE sent_at END,
         provider_id = COALESCE(p_provider_id, provider_id),
         error = p_error
   WHERE notice_key = p_notice_key AND user_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.seller_notice_record(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_notice_record(text, uuid, text, text) TO service_role;
