-- ============================================================================
-- fraud_flags / gdpr_requests / inform_disclosures — close them to the anon key
--
-- Problem (reproduced on a local stack 2026-09-28): each table has a baseline
-- policy "Service role full access to <table>" with NO `TO` clause, so it
-- applies to PUBLIC with USING (true) WITH CHECK (true), and the baseline
-- GRANT ALL gives anon + authenticated every privilege. With nothing but the
-- public anon key, anyone could read, insert, update and delete:
--   · fraud_flags        — every flag (user_id, rule, description, metadata);
--   · gdpr_requests      — every export / deletion request, incl. export_url;
--   · inform_disclosures — sellers' legal name, address, phone, email,
--                          tax-id / bank last 4, consent IP.
-- The admin pages for all three read and wrote only through that policy.
-- table-posture.guard's LEGACY_BASELINE checked grants, not policies, so it
-- recorded these three as "RLS-scoped" when they were not.
--
-- After:
--   · the service-role policies are scoped TO service_role (which bypasses
--     RLS anyway; the name now matches what the policy does);
--   · admins — is_admin(): an active admin_roles row, the same check
--     requireAdmin() makes; there is no finer fraud / GDPR / INFORM
--     permission — read and update every row through their session client,
--     and insert fraud flags (runFraudScan);
--   · users keep their own-row read + insert, now TO authenticated, and an
--     insert can no longer carry what only an admin sets: a disclosure that
--     arrives certified, a GDPR row with an export_url, processor or
--     rejection;
--   · anon holds no privilege on the three tables; authenticated loses
--     DELETE / TRUNCATE / REFERENCES / TRIGGER (nothing deletes through a
--     session; deleting a user cascades as the table owner).
-- No app change: every reader and writer already runs as an admin or as the
-- row's own user.
--
-- Pinned by src/test/guards/private-tables-rls.guard.integration.test.ts.
-- ============================================================================

-- ── fraud_flags ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access to fraud_flags" ON public.fraud_flags;
CREATE POLICY "Service role full access to fraud_flags" ON public.fraud_flags
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view fraud flags" ON public.fraud_flags
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can create fraud flags" ON public.fraud_flags
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update fraud flags" ON public.fraud_flags
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── gdpr_requests ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access to gdpr_requests" ON public.gdpr_requests;
CREATE POLICY "Service role full access to gdpr_requests" ON public.gdpr_requests
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own gdpr requests" ON public.gdpr_requests;
CREATE POLICY "Users can view own gdpr requests" ON public.gdpr_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- What the app inserts: a pending request (submitGdprRequest) or the audit
-- row of a self-service export (exportMyData: type export, status completed).
DROP POLICY IF EXISTS "Users can submit gdpr requests" ON public.gdpr_requests;
CREATE POLICY "Users can submit gdpr requests" ON public.gdpr_requests
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND (status = 'pending' OR (type = 'export' AND status = 'completed'))
    AND export_url IS NULL
    AND processed_by IS NULL
    AND rejection_reason IS NULL
  );

CREATE POLICY "Admins can view gdpr requests" ON public.gdpr_requests
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can update gdpr requests" ON public.gdpr_requests
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── inform_disclosures ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access to inform_disclosures" ON public.inform_disclosures;
CREATE POLICY "Service role full access to inform_disclosures" ON public.inform_disclosures
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Sellers can view own inform disclosures" ON public.inform_disclosures;
CREATE POLICY "Sellers can view own inform disclosures" ON public.inform_disclosures
  FOR SELECT TO authenticated USING (auth.uid() = seller_id);

-- What the app inserts (submitInformDisclosure): a new version, 'submitted'.
DROP POLICY IF EXISTS "Sellers can submit inform disclosures" ON public.inform_disclosures;
CREATE POLICY "Sellers can submit inform disclosures" ON public.inform_disclosures
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = seller_id
    AND status = 'submitted'
    AND certified_at IS NULL
    AND certified_by IS NULL
    AND rejection_reason IS NULL
    AND superseded_by IS NULL
  );

CREATE POLICY "Admins can view inform disclosures" ON public.inform_disclosures
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can update inform disclosures" ON public.inform_disclosures
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE public.fraud_flags, public.gdpr_requests, public.inform_disclosures FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.fraud_flags, public.gdpr_requests, public.inform_disclosures FROM authenticated;
