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

-- ── DB-006: the default EXECUTE grant is the root cause — revoke it ─────────
-- Baseline 20260101000000:15110-15111 set ALTER DEFAULT PRIVILEGES … GRANT ALL
-- ON FUNCTIONS TO anon, authenticated for role postgres (the role the CLI runs
-- migrations as), so every function ships anon-callable unless its migration
-- remembers to REVOKE. After this the default ACL is {postgres=X,
-- service_role=X}: a new function is service-only until granted. (The
-- parallel supabase_admin default ACL is platform-owned; not touchable here.)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Sweep: every remaining SECURITY DEFINER function gets an explicit grant set.
-- Buckets (see docs/audit/2026-09-11/db-p0-grants-plan.md, owner-approved):
--   service_role only      — no user-facing caller, or called only through the
--                            service client (cron bodies, tier stats, crypto,
--                            banner/inventory/category helpers, ledger, SAB).
--   authenticated + service — body reads auth.uid() or PERFORMs
--                            assert_moderator(); check_seller_needs_moderation
--                            is called by the SECURITY INVOKER listings trigger
--                            as the inserting user, so users must keep it.
--   anon + authenticated + service — is_admin()/has_permission() are evaluated
--                            inside RLS policies as the calling role;
--                            sab_public_price_catalog_rows() backs the public
--                            security_invoker view sab_public_price_catalog.
--   trigger functions      — PostgREST cannot call them and Postgres does not
--                            check EXECUTE at fire time (verified on the local
--                            stack); closed for hygiene.
-- Dead functions (DB-007/DB-009: mark_trustpilot_invitation_sent,
-- increment_listing_views, get_user_role, has_role, apply_rank_strikes) are
-- closed here; dropping them is a P3 follow-up.

-- service_role only
SELECT pg_temp.db_p0_set_exec('public.mark_trustpilot_invitation_sent(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.increment_listing_views(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.get_user_role(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.has_role(text, uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.apply_rank_strikes()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.mark_inactive_sellers_offline()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.upgrade_all_seller_tiers()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.can_seller_reapply(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.get_seller_tier_info(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.check_seller_tier_eligibility(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.sab_recompute_tradeable()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.seller_is_in_payout_hold(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.assert_moderator()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.cleanup_expired_idempotency_keys()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.generate_referral_code(text)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.encrypt_delivery_data(text, text)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.decrypt_delivery_data(text, text)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.can_upload_custom_banner(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.get_user_banner(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.get_available_inventory_count(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.get_category_icon(uuid)', ARRAY['service_role']);
-- already service-role only on prod, restated
SELECT pg_temp.db_p0_set_exec('public.ledger_balance(ledger_owner_type, uuid, ledger_account_kind, character)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.ledger_integrity_check()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.ledger_resolve_account(ledger_owner_type, uuid, ledger_account_kind, character)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.ledger_test_cleanup(text)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.ledger_test_cleanup_by_order(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.post_journal(text, jsonb, text, uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.sab_capture_price_history(date)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.sab_import_market_listings(text, jsonb)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.sab_publish_market_estimates()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.sab_refresh_price_display()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.sab_refresh_price_snapshots(timestamp with time zone)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.sab_reparse_market_listings(integer)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.sab_sync_dropmarket_market_observations(timestamp with time zone)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.safedrop_transition(uuid, text, text, text, bigint)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.seller_available_balance(uuid, character)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.user_wallet_balance(uuid, character)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.wallet_credit(uuid, bigint, character, ledger_account_kind, text, text, uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.wallet_spend(uuid, bigint, character, ledger_account_kind, text, text, uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.webhook_event_claim(text, text, text)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.webhook_event_mark(text, text, webhook_event_status, jsonb)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.withdrawal_debit(uuid, bigint, text, text)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.withdrawal_payout(uuid)', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.withdrawal_reversal(uuid)', ARRAY['service_role']);
-- authenticated + service_role
SELECT pg_temp.db_p0_set_exec('public.approve_listing(uuid, uuid)', ARRAY['authenticated','service_role']);
SELECT pg_temp.db_p0_set_exec('public.reject_listing(uuid, uuid, text)', ARRAY['authenticated','service_role']);
SELECT pg_temp.db_p0_set_exec('public.request_listing_changes(uuid, uuid, text)', ARRAY['authenticated','service_role']);
SELECT pg_temp.db_p0_set_exec('public.get_my_permissions()', ARRAY['authenticated','service_role']);
SELECT pg_temp.db_p0_set_exec('public.get_admin_role()', ARRAY['authenticated','service_role']);
SELECT pg_temp.db_p0_set_exec('public.is_super_admin_safe()', ARRAY['authenticated','service_role']);
SELECT pg_temp.db_p0_set_exec('public.can_edit_review(uuid)', ARRAY['authenticated','service_role']);
SELECT pg_temp.db_p0_set_exec('public.check_seller_needs_moderation(uuid)', ARRAY['authenticated','service_role']);
SELECT pg_temp.db_p0_set_exec('public.get_seller_publish_policy(uuid)', ARRAY['authenticated','service_role']);
SELECT pg_temp.db_p0_set_exec('public.withdraw_seller_application(uuid, uuid)', ARRAY['authenticated','service_role']);
SELECT pg_temp.db_p0_set_exec('public.reject_seller_application(uuid, uuid, text, text)', ARRAY['authenticated','service_role']);
SELECT pg_temp.db_p0_set_exec('public.checkout_wallet_hold_minor(uuid)', ARRAY['authenticated','service_role']);
-- anon + authenticated + service_role
SELECT pg_temp.db_p0_set_exec('public.is_admin()', ARRAY['anon','authenticated','service_role']);
SELECT pg_temp.db_p0_set_exec('public.has_permission(text)', ARRAY['anon','authenticated','service_role']);
SELECT pg_temp.db_p0_set_exec('public.sab_public_price_catalog_rows()', ARRAY['anon','authenticated','service_role']);
-- SECURITY DEFINER trigger functions
SELECT pg_temp.db_p0_set_exec('public.generate_referral_code_for_new_user()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.guard_listings_protected_columns()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.guard_orders_protected_columns()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.guard_profiles_protected_columns()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.guard_reviews_moderation_columns()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.guard_seller_applications_review_columns()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.handle_new_user()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.initialize_seller_presence()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.log_profile_privilege_changes()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.prevent_audit_log_modification()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.prevent_profile_privilege_escalation()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.schedule_trustpilot_invitation()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.sync_listing_quantity_with_inventory()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.track_listing_price_change()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.track_seller_activity()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.update_conversation_last_message()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.update_listing_quantity()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.update_review_edit_tracking()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.update_seller_rating()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.update_wallet_balance()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.validate_banner_update()', ARRAY['service_role']);
SELECT pg_temp.db_p0_set_exec('public.validate_order_status_transition()', ARRAY['service_role']);

-- Posture probe (service-role only) — what the guard test and a prod
-- verification read back: is the default ACL closed, which views still run
-- as owner, which SECURITY DEFINER functions anon / authenticated can execute.
CREATE OR REPLACE FUNCTION public.db_p0_posture() RETURNS jsonb
  LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT jsonb_build_object(
    'default_acl_grants_anon_or_authenticated',
      COALESCE((SELECT d.defaclacl::text ~ '(^\{|,)(anon|authenticated)?='
                FROM pg_default_acl d
                WHERE d.defaclrole = 'postgres'::regrole
                  AND d.defaclnamespace = 'public'::regnamespace
                  AND d.defaclobjtype = 'f'), true),
    'views_without_security_invoker',
      COALESCE((SELECT jsonb_agg(c.relname ORDER BY c.relname)
                FROM pg_class c
                WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'v'
                  AND NOT COALESCE((SELECT o.option_value IN ('on','true')
                                    FROM pg_options_to_table(c.reloptions) o
                                    WHERE o.option_name = 'security_invoker'), false)),
               '[]'::jsonb),
    'anon_executable_definers',
      COALESCE((SELECT jsonb_agg(p.proname ORDER BY p.proname)
                FROM pg_proc p
                WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
                  AND p.prorettype <> 'trigger'::regtype
                  AND has_function_privilege('anon', p.oid, 'EXECUTE')), '[]'::jsonb),
    'authenticated_executable_definers',
      COALESCE((SELECT jsonb_agg(p.proname ORDER BY p.proname)
                FROM pg_proc p
                WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
                  AND p.prorettype <> 'trigger'::regtype
                  AND has_function_privilege('authenticated', p.oid, 'EXECUTE')), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.db_p0_posture() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.db_p0_posture() TO service_role;

-- ── DB-005 (P1): upgrade_all_seller_tiers() selected a column that does not exist
-- Body (20260908110000:239, introduced 20260906000000:329) filtered
-- `WHERE is_seller = true`; profiles has no is_seller column (role /
-- seller_tier / tier_pinned exist), so the daily /api/cron/upgrade-seller-tiers
-- has failed on every run since 2026-09-06 and no seller auto-upgraded.
-- Re-created from the live body with `role = 'seller'`, the entry-tier
-- fallback read from seller_tier_config (never hard-code a tier name — prod
-- carries the metal set), SET search_path, and the service-only grant.
-- apply_rank_strikes() has the same bug but no caller (ROUTE-005); it is
-- closed above and left for the P3 drop.
CREATE OR REPLACE FUNCTION public.upgrade_all_seller_tiers() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  v_seller        RECORD;
  v_new_tier      TEXT;
  v_entry_tier    TEXT;
  v_current_order INTEGER;
  v_new_order     INTEGER;
  v_count         INTEGER := 0;
BEGIN
  SELECT tier INTO v_entry_tier FROM public.seller_tier_config ORDER BY sort_order ASC LIMIT 1;

  FOR v_seller IN
    SELECT id, seller_tier FROM public.profiles
    WHERE role = 'seller' AND tier_pinned = false
  LOOP
    v_new_tier := check_seller_tier_eligibility(v_seller.id);

    SELECT COALESCE(sort_order, 0) INTO v_current_order
    FROM public.seller_tier_config
    WHERE tier = COALESCE(v_seller.seller_tier, v_entry_tier);

    SELECT COALESCE(sort_order, 0) INTO v_new_order
    FROM public.seller_tier_config
    WHERE tier = v_new_tier;

    IF v_new_order > v_current_order THEN
      UPDATE public.profiles
      SET seller_tier = v_new_tier, tier_strikes = 0
      WHERE id = v_seller.id;

      INSERT INTO public.seller_tier_history (user_id, previous_tier, new_tier, reason)
      VALUES (v_seller.id, v_seller.seller_tier, v_new_tier, 'auto_upgrade_90d_window');

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;
SELECT pg_temp.db_p0_set_exec('public.upgrade_all_seller_tiers()', ARRAY['service_role']);

DROP FUNCTION pg_temp.db_p0_set_exec(text, text[]);
