-- DLT-005/006 — close the TABLES default privilege, backfill the five tables
-- that relied on RLS alone, and add the posture probe that makes both
-- checkable from a test.
--
-- Root cause: migration 20260913100000 revoked the baseline's default EXECUTE
-- grant on FUNCTIONS (DB-006) but left the TABLES default untouched. Verified
-- live on 2026-09-20:
--   DEFAULT_ACL_FUNCS  = {postgres=X/postgres, service_role=X/postgres}
--   DEFAULT_ACL_TABLES = {postgres=arwdDxtm/…, anon=arwdDxtm/…,
--                         authenticated=arwdDxtm/…, service_role=arwdDxtm/…}
-- so every new table is born with SELECT/INSERT/UPDATE/DELETE granted to anon
-- and RLS is the only thing standing between it and the public key. 96 public
-- tables currently carry an anon SELECT grant for this reason.
--
-- NOT EXPLOITABLE TODAY, and that was checked rather than assumed: zero public
-- tables have RLS disabled, and every SELECT policy on a sensitive table
-- (ledger_*, wallet_*, payouts, webhook_events, seller_kyc_documents,
-- audit_logs, admin_roles) is scoped to auth.uid() or an admin check. This is
-- one forgotten `ENABLE ROW LEVEL SECURITY` away from being Critical, which is
-- exactly what the guard now prevents.
--
-- SCOPE, deliberately narrow: this migration does NOT mass-revoke the 96
-- existing tables. A blanket revoke risks breaking a working read path for no
-- security gain today, and each one deserves its own review. It closes the
-- SOURCE (the default privilege), backfills the five tables the delta audit
-- named, and installs the probe so the guard test can hold the line from here.
-- The existing 96 are pinned as a reviewed baseline in the guard's allow-list.
--
-- Additive: no DROP, no policy removed.

-- ── 1. Marker ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.table_posture_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.table_posture_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.table_posture_version() TO service_role;

-- ── 2. Close the source: no more world-granted new tables ─────────────────
-- Mirrors what 20260913100000:117-118 did for FUNCTIONS. From here a new table
-- is born with NO anon/authenticated grant, so forgetting `revoke all` is no
-- longer a security-relevant mistake.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

-- ── 3. Backfill the five tables that relied on RLS alone ──────────────────
-- Each already had RLS on with zero policies (deny-all), which is why nothing
-- was reachable. These are crawl internals and analytics rollups: service-role
-- only by intent, so the explicit revoke matches the sibling tables in the
-- same migrations (trend radar, rate_limits, sab_pipeline_locks) that did
-- remember it.
REVOKE ALL ON TABLE public.values_games              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.values_item_aliases       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.values_rejection_patterns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.values_raw_listings       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.sab_raw_listing_daily     FROM PUBLIC, anon, authenticated;

-- ── 4. The posture probe db_p0_posture() was missing ──────────────────────
-- db_p0_posture() filters `defaclobjtype = 'f'` and has no equivalent for
-- tables ('r'), no check for RLS-on-with-zero-policies, and no check for a
-- table granted to anon. This is that missing half.
CREATE OR REPLACE FUNCTION public.public_table_posture()
RETURNS TABLE (
  table_name   text,
  rls_enabled  boolean,
  policy_count integer,
  anon_select  boolean,
  anon_write   boolean,
  auth_select  boolean,
  auth_write   boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT
    c.relname::text,
    c.relrowsecurity,
    (SELECT count(*)::integer FROM pg_policy p WHERE p.polrelid = c.oid),
    has_table_privilege('anon', c.oid, 'SELECT'),
    (has_table_privilege('anon', c.oid, 'INSERT')
      OR has_table_privilege('anon', c.oid, 'UPDATE')
      OR has_table_privilege('anon', c.oid, 'DELETE')),
    has_table_privilege('authenticated', c.oid, 'SELECT'),
    (has_table_privilege('authenticated', c.oid, 'INSERT')
      OR has_table_privilege('authenticated', c.oid, 'UPDATE')
      OR has_table_privilege('authenticated', c.oid, 'DELETE'))
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relkind = 'r'
    -- Supabase-managed bookkeeping the app does not own.
    AND c.relname NOT LIKE 'pg_%'
    AND c.relname <> 'schema_migrations'
  ORDER BY c.relname;
$$;
REVOKE ALL ON FUNCTION public.public_table_posture() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_table_posture() TO service_role;

/** TRUE when the TABLES default still grants anon or authenticated. */
CREATE OR REPLACE FUNCTION public.default_table_acl_grants_public()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT COALESCE(
    (SELECT d.defaclacl::text ~ '(^\{|,)(anon|authenticated)='
       FROM pg_default_acl d
      WHERE d.defaclrole = 'postgres'::regrole
        AND d.defaclnamespace = 'public'::regnamespace
        AND d.defaclobjtype = 'r'),
    false);
$$;
REVOKE ALL ON FUNCTION public.default_table_acl_grants_public() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.default_table_acl_grants_public() TO service_role;

-- ── 5. Proof — refuse to finish half-applied ──────────────────────────────
DO $$
DECLARE
  v_bad text;
BEGIN
  IF public.default_table_acl_grants_public() THEN
    RAISE EXCEPTION 'DLT-005: the TABLES default privilege still grants anon/authenticated';
  END IF;

  SELECT string_agg(t.name, ', ') INTO v_bad
    FROM (VALUES
      ('values_games'),('values_item_aliases'),('values_rejection_patterns'),
      ('values_raw_listings'),('sab_raw_listing_daily')
    ) AS t(name)
   WHERE has_table_privilege('anon', ('public.' || t.name)::regclass, 'SELECT')
      OR has_table_privilege('authenticated', ('public.' || t.name)::regclass, 'SELECT');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'DLT-005: backfilled table(s) still granted to anon/authenticated: %', v_bad;
  END IF;

  -- Nothing in public may have RLS off: that is the condition under which the
  -- default grant would have been a live exposure.
  SELECT string_agg(c.relname, ', ') INTO v_bad
    FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
     AND NOT c.relrowsecurity
     AND c.relname <> 'schema_migrations';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'DLT-005: table(s) without RLS: %', v_bad;
  END IF;
END $$;
