-- ============================================================================
-- DB-002 / DB-003 / DB-004 / DB-006 (P0) + DB-005 (P1) — audit 2026-09-11,
-- hotfix/db-p0. Idempotent: safe to re-run.
--
-- Root cause (DB-006): the baseline's
--   ALTER DEFAULT PRIVILEGES … GRANT ALL ON FUNCTIONS TO anon, authenticated
-- made every new public function executable with the public anon key unless a
-- migration remembered to REVOKE. 39 of 69 non-trigger SECURITY DEFINER
-- functions were anon-callable on prod, and 10 views created without
-- security_invoker ran with the owner's BYPASSRLS. Reproduced on the local
-- stack with SET ROLE anon (2026-09-12): tax id + bank routing through
-- seller_applications_with_users, order freeze/release/refund through the
-- escrow definers, delivered credentials through
-- get_orders_ready_for_auto_release().
--
-- Model: every SECURITY DEFINER function gets an explicit REVOKE from PUBLIC /
-- anon / authenticated and a GRANT to exactly the roles that need it; every
-- view runs as the caller; the default privilege is revoked so the next
-- function ships closed. Nothing is dropped here (drops of the dead functions
-- are logged as a P3 follow-up).
-- ============================================================================

-- Probe for integration tests: present ⇒ this migration is applied.
CREATE OR REPLACE FUNCTION public.db_p0_guards_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.db_p0_guards_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.db_p0_guards_version() TO service_role;

-- Session-local helper (pg_temp, dropped at the end): revoke EXECUTE from
-- PUBLIC / anon / authenticated on one function and grant it to the listed
-- roles. Skips with a NOTICE if the signature does not exist, so a partial
-- environment cannot abort the file. The owner (postgres) always keeps EXECUTE.
CREATE FUNCTION pg_temp.db_p0_set_exec(p_signature text, p_roles text[]) RETURNS void
  LANGUAGE plpgsql AS $$
DECLARE
  v_fn   regprocedure := to_regprocedure(p_signature);
  v_role text;
BEGIN
  IF v_fn IS NULL THEN
    RAISE NOTICE 'db_p0: % not present, skipped', p_signature;
    RETURN;
  END IF;
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn::text);
  FOREACH v_role IN ARRAY p_roles LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', v_fn::text, v_role);
  END LOOP;
END;
$$;

-- ── DB-002: views run as the caller; the anon key cannot read them ──────────
-- 10 views were created without security_invoker, owned by postgres
-- (BYPASSRLS), SELECT-granted to anon + authenticated ⇒ RLS on
-- seller_applications, disputes, listings, reviews, audit_logs, orders and
-- profiles was bypassed for anyone holding the anon key.
-- authenticated KEEPS SELECT: the admin pages read seller_applications_with_users,
-- disputes_with_users and recent_security_events through the session client,
-- and sellers read seller_dashboard_stats through the browser client — with
-- security_invoker the base tables' own policies (is_admin() / own rows) now
-- decide what each caller sees. None of the 10 references auth.users.
DO $$
DECLARE v_view text;
BEGIN
  FOREACH v_view IN ARRAY ARRAY[
    'seller_applications_with_users', 'disputes_with_users', 'moderation_queue',
    'admin_review_overview', 'recent_security_events', 'failed_operations',
    'seller_dashboard_stats', 'seller_shop_banners', 'shop_analytics_summary',
    'trustpilot_stats'
  ] LOOP
    IF to_regclass('public.' || v_view) IS NULL THEN
      RAISE NOTICE 'db_p0: view % not present, skipped', v_view;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v_view);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', v_view);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated, service_role', v_view);
  END LOOP;
END;
$$;

-- ── DB-003: escrow writers are service-role only ────────────────────────────
-- release_escrow / refund_escrow / freeze_escrow (and the DB-009 pair
-- release_escrow_to_seller_balance / cleanup_old_audit_logs) are SECURITY
-- DEFINER, set app.guarded_write themselves, check no caller, and were
-- EXECUTE-granted to anon: the anon key froze a held order, then released it
-- (status=completed, escrow_status=released, no journal — seller never paid).
-- Zero app callers; superseded by safedrop_transition. Dropping them is a P3
-- follow-up — here they close. release_with_reserve / release_due_reserves
-- ARE called (src/lib/escrow/reserve.ts) and were already service-only;
-- restated so this file is the single source of truth.
SELECT pg_temp.db_p0_set_exec('public.release_escrow(uuid, text)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.refund_escrow(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.freeze_escrow(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.release_escrow_to_seller_balance(uuid, uuid, numeric)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.cleanup_old_audit_logs(integer)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.release_with_reserve(uuid, text, numeric, bigint, text)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.release_due_reserves(integer)', ARRAY['service_role']);

-- ── DB-004: whole-row definer getters are service-role only ─────────────────
-- get_orders_ready_for_auto_release() RETURNS SETOF orders (delivered
-- credentials: instant_delivery_code, delivery_details),
-- get_pending_trustpilot_invitations() (buyer email + invitation_token) and
-- get_listings_pending_moderation() (unmoderated listings) had no caller check
-- and anon EXECUTE. Only the first is used by the app — from the auto-release
-- cron and the admin trigger route, which this hotfix moves onto the
-- service-role client (they used the session client, i.e. ran as anon).
SELECT pg_temp.db_p0_set_exec('public.get_orders_ready_for_auto_release()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.get_pending_trustpilot_invitations()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.get_listings_pending_moderation()', ARRAY['service_role']);
