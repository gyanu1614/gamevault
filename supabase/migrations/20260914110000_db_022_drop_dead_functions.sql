-- DB-022 — drop the 12 dead SECURITY DEFINER functions.
--
-- These are bucket A of docs/audit/2026-09-11/db-p0-grants-plan.md: the
-- caller-less definers behind DB-003 / DB-004 / DB-007 / DB-009 (and the
-- orphaned, broken apply_rank_strikes from DB-005). On 2026-09-12 the
-- hotfix (20260913100000_db_p0_grants.sql) revoked EXECUTE on all of them
-- down to service_role rather than dropping, so the dead surface stayed in
-- the catalog and in src/types/database.types.ts. This migration removes it.
--
-- Caller re-scan before dropping (2026-09-14): grep over src/,
-- supabase/functions/, scripts/, vercel.json and every migration found no
-- app caller — only src/types/database.types.ts declarations and the
-- guard-test allow-lists (both updated in this commit). On the local stack
-- all 12 report 0 pg_depend references, 0 triggers, 0 policy expressions,
-- 0 referencing function bodies and 0 views.
--
-- Idempotent: DROP FUNCTION IF EXISTS, safe to re-run.

-- DB-003 — anon-callable escrow state writers, superseded by safedrop_transition.
DROP FUNCTION IF EXISTS public.release_escrow(order_id uuid, method text);
DROP FUNCTION IF EXISTS public.refund_escrow(order_id uuid);
DROP FUNCTION IF EXISTS public.freeze_escrow(order_id uuid);

-- DB-009 — dead and already broken (missing audit_logs.performed_by column;
-- cleanup_old_audit_logs is always refused by trg_prevent_audit_log_delete).
DROP FUNCTION IF EXISTS public.release_escrow_to_seller_balance(p_order_id uuid, p_seller_id uuid, p_amount numeric);
DROP FUNCTION IF EXISTS public.cleanup_old_audit_logs(days_to_keep integer);

-- DB-004 — definer getters that returned delivery credentials / buyer emails.
DROP FUNCTION IF EXISTS public.get_pending_trustpilot_invitations();
DROP FUNCTION IF EXISTS public.get_listings_pending_moderation();

-- DB-007 — lower-impact caller-less definers.
DROP FUNCTION IF EXISTS public.mark_trustpilot_invitation_sent(invitation_id uuid);
DROP FUNCTION IF EXISTS public.increment_listing_views(listing_uuid uuid);
DROP FUNCTION IF EXISTS public.get_user_role(user_id uuid);
DROP FUNCTION IF EXISTS public.has_role(required_role text, user_id uuid);

-- DB-005 — orphaned (route removed, ROUTE-005) and broken (profiles.is_seller
-- does not exist). upgrade_all_seller_tiers was repaired and stays.
DROP FUNCTION IF EXISTS public.apply_rank_strikes();
