-- ============================================================================
-- seller_tier_history / seller_verification_logs / admin_action_logs — no
-- more forged history
--
-- Problem (reproduced on a local stack 2026-09-28): each table carries a
-- baseline INSERT policy with WITH CHECK (true) — "System can create tier
-- history" and "System can create logs" with no TO clause (PUBLIC), "System
-- can create action logs" TO authenticated — on top of GRANT ALL to anon +
-- authenticated. With the public anon key or any account, anyone could insert
-- a seller's tier change (bronze → legendary), an 'approved' entry into any
-- seller application's verification audit trail, or (signed in) an admin
-- action log entry.
--
-- The "system" writers never needed an open policy:
--   · seller_tier_history is written by the service role
--     (admin-seller-detail.ts) and upgrade_all_seller_tiers (definer);
--   · seller_verification_logs is written by admin sessions (the existing
--     "Admins can create verification logs", is_admin()) and by two AFTER
--     triggers — log_seller_application_changes on seller_applications and
--     log_kyc_document_upload on seller_kyc_documents — whose functions ran
--     as the CALLER (the applicant) through the open policy;
--   · admin_action_logs has no writer or reader in the app or in SQL.
--
-- After:
--   · the two trigger functions run as their owner (SECURITY DEFINER,
--     search_path pinned) and nobody may call them directly, so only the
--     triggers write "system" entries;
--   · the three open INSERT policies are dropped (service_role bypasses RLS);
--   · anon holds no privilege on either table; authenticated keeps SELECT
--     (own rows / admins — policies unchanged) and INSERT on the log
--     (admins only, is_admin()), nothing else; admin_action_logs is
--     service-role only.
--
-- Pinned by src/test/guards/log-tables-rls.guard.integration.test.ts.
-- ============================================================================

ALTER FUNCTION public.log_seller_application_event() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.log_document_upload() SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.log_seller_application_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_document_upload() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "System can create tier history" ON public.seller_tier_history;
DROP POLICY IF EXISTS "System can create logs" ON public.seller_verification_logs;
DROP POLICY IF EXISTS "System can create action logs" ON public.admin_action_logs;

REVOKE ALL ON TABLE public.seller_tier_history, public.seller_verification_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.seller_tier_history FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.seller_verification_logs FROM authenticated;
REVOKE ALL ON TABLE public.admin_action_logs FROM anon, authenticated;
