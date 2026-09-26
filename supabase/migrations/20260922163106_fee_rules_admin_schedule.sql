-- ============================================================================
-- FEE ENGINE — PR 5: the admin write seam for pair-scope base rules
--                                                 (fee-engine.md §5.2, §5.3)
--
-- Money effect: NONE. No rate changes; two service-role-only functions the
-- admin Fees tab calls so that scheduling a new base rate for a (game,
-- category) pair is ONE atomic statement:
--
--   fee_rule_schedule_base(pair, pct, starts_at, note, admin)
--     · refuses a start inside the notice window (same rule as the trigger,
--       raised here first so the admin gets the earliest permitted date);
--     · refuses when a LATER (or same-day) pair base rule is already scheduled
--       — cancel that first, never silently re-order the timeline;
--     · closes the pair's currently open-ended base rule AT the new start
--       (ends_at = starts_at; '[)' ranges hand over gap-free). The notice
--       trigger re-checks starts_at on UPDATE and would refuse to let a
--       historical rule end (pinned by fee-resolver.guard), so the close runs
--       under app.fee_backfill — transaction-local, set ONLY around that one
--       UPDATE, off again before the INSERT so the new row IS validated by
--       the trigger;
--     · inserts the new rule and returns both rows (old → audit old_value).
--
--   fee_rule_cancel_scheduled(rule_id)
--     · deletes a pair base rule that has NOT started (never applied to an
--       order — fee-engine.md §6.2: "DELETE of the future rows before they
--       start is a clean no-op"), and re-opens the rule it had closed (the
--       pair rule whose ends_at equals the cancelled start) so the pair does
--       not fall to the category default at that date. Refuses once started.
--
-- Promos need neither: the notice trigger exempts kind='promo', so the admin
-- action inserts / ends them directly through the service-role client.
--
-- CONVENTIONS (CLAUDE.md): SECURITY DEFINER + SET search_path = public;
-- service-role-only (EXECUTE revoked from PUBLIC/anon/authenticated) — no
-- db-p0-grants allow-list entry needed. Audit rows are written by the action
-- (it knows WHICH admin acted; a service-role call has no auth.uid()).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fee_rule_schedule_base(
  p_game_category_id uuid,
  p_pct              numeric,
  p_starts_at        timestamptz,
  p_note             text DEFAULT NULL,
  p_created_by       uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type      text;
  v_days      integer;
  v_earliest  timestamptz;
  v_later     public.fee_rules;
  v_open      public.fee_rules;
  v_new       public.fee_rules;
BEGIN
  IF p_game_category_id IS NULL THEN
    RAISE EXCEPTION 'fee_rule_schedule_base: p_game_category_id is required'
      USING ERRCODE = 'null_value_not_allowed';
  END IF;
  SELECT gc.type INTO v_type FROM public.game_categories gc WHERE gc.id = p_game_category_id;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'fee_rule_schedule_base: no game_category %', p_game_category_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF p_pct IS NULL OR p_pct < 0 OR p_pct > 50 THEN
    RAISE EXCEPTION 'fee_rules: rate must be between 0%% and 50%%'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT base_change_notice_days INTO v_days FROM public.platform_fee_settings WHERE id;
  v_days := COALESCE(v_days, 14);
  v_earliest := now() + make_interval(days => v_days);
  IF p_starts_at IS NULL OR p_starts_at < v_earliest THEN
    RAISE EXCEPTION 'fee_rules: a base rate change needs % days notice (earliest permitted start: %)',
      v_days, v_earliest
      USING ERRCODE = 'check_violation';
  END IF;

  -- A later/equal scheduled pair rule would sit AFTER this one in the
  -- timeline; the exclusion constraint would refuse the overlap anyway, but
  -- name the reason: cancel the scheduled rule first.
  SELECT * INTO v_later
    FROM public.fee_rules fr
   WHERE fr.kind = 'base' AND fr.scope = 'game_category'
     AND fr.game_category_id = p_game_category_id
     AND fr.starts_at >= p_starts_at
   ORDER BY fr.starts_at LIMIT 1;
  IF v_later.id IS NOT NULL THEN
    RAISE EXCEPTION 'fee_rules: a base rate of %%% is already scheduled for this category from % — cancel it first',
      v_later.pct, v_later.starts_at
      USING ERRCODE = 'exclusion_violation';
  END IF;

  -- Close the currently open-ended pair rule at the new start. UPDATE is
  -- re-checked by the notice trigger against the OLD starts_at, hence the
  -- transaction-local backfill GUC for exactly this statement.
  SELECT * INTO v_open
    FROM public.fee_rules fr
   WHERE fr.kind = 'base' AND fr.scope = 'game_category'
     AND fr.game_category_id = p_game_category_id
     AND fr.ends_at IS NULL AND fr.starts_at < p_starts_at
   FOR UPDATE;
  IF v_open.id IS NOT NULL THEN
    PERFORM set_config('app.fee_backfill', 'on', true);
    UPDATE public.fee_rules SET ends_at = p_starts_at WHERE id = v_open.id RETURNING * INTO v_open;
    PERFORM set_config('app.fee_backfill', 'off', true);
  END IF;

  -- The new rule: validated by both triggers (sync + notice) and the
  -- exclusion constraint like any other insert.
  INSERT INTO public.fee_rules (kind, scope, category_type, game_category_id, pct, starts_at, note, created_by)
  VALUES ('base', 'game_category', v_type, p_game_category_id, p_pct, p_starts_at, p_note, p_created_by)
  RETURNING * INTO v_new;

  -- to_jsonb() of an unset record is an all-NULL object, not JSON null.
  RETURN jsonb_build_object(
    'closed',   CASE WHEN v_open.id IS NULL THEN NULL ELSE to_jsonb(v_open) END,
    'inserted', to_jsonb(v_new));
END;
$$;

COMMENT ON FUNCTION public.fee_rule_schedule_base(uuid, numeric, timestamptz, text, uuid) IS
  'Admin seam (fee engine PR 5): schedule a pair-scope base rate — closes the pair''s open-ended base rule at the new start and inserts the new one atomically. Notice window enforced; service-role only; audit row written by the calling action.';

CREATE OR REPLACE FUNCTION public.fee_rule_cancel_scheduled(p_rule_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule     public.fee_rules;
  v_reopened public.fee_rules;
BEGIN
  SELECT * INTO v_rule FROM public.fee_rules WHERE id = p_rule_id FOR UPDATE;
  IF v_rule.id IS NULL THEN
    RAISE EXCEPTION 'fee_rules: no rule %', p_rule_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_rule.kind <> 'base' OR v_rule.scope <> 'game_category' THEN
    RAISE EXCEPTION 'fee_rules: only a pair-scope base rule can be cancelled here'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_rule.starts_at <= now() THEN
    RAISE EXCEPTION 'fee_rules: rule % started at % — sellers have been charged under it; schedule a new rate instead',
      p_rule_id, v_rule.starts_at
      USING ERRCODE = 'check_violation';
  END IF;

  DELETE FROM public.fee_rules WHERE id = v_rule.id;

  -- Re-open the rule this one had closed, if any. Its starts_at is historical,
  -- so the notice trigger needs the backfill GUC for this one UPDATE.
  SELECT * INTO v_reopened
    FROM public.fee_rules fr
   WHERE fr.kind = 'base' AND fr.scope = 'game_category'
     AND fr.game_category_id = v_rule.game_category_id
     AND fr.ends_at = v_rule.starts_at
   ORDER BY fr.starts_at DESC LIMIT 1
   FOR UPDATE;
  IF v_reopened.id IS NOT NULL THEN
    PERFORM set_config('app.fee_backfill', 'on', true);
    UPDATE public.fee_rules SET ends_at = NULL WHERE id = v_reopened.id RETURNING * INTO v_reopened;
    PERFORM set_config('app.fee_backfill', 'off', true);
  END IF;

  RETURN jsonb_build_object(
    'deleted',  to_jsonb(v_rule),
    'reopened', CASE WHEN v_reopened.id IS NULL THEN NULL ELSE to_jsonb(v_reopened) END);
END;
$$;

COMMENT ON FUNCTION public.fee_rule_cancel_scheduled(uuid) IS
  'Admin seam (fee engine PR 5): delete a pair-scope base rule that has not started and re-open the rule it closed. Refuses once the rule has applied.';

REVOKE ALL ON FUNCTION public.fee_rule_schedule_base(uuid, numeric, timestamptz, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fee_rule_schedule_base(uuid, numeric, timestamptz, text, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.fee_rule_cancel_scheduled(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fee_rule_cancel_scheduled(uuid) TO service_role;

-- ── Proof — refuse to finish half-applied ──────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.fee_rule_schedule_base(uuid, numeric, timestamptz, text, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fee_rule_schedule_base(uuid, numeric, timestamptz, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'fee engine PR 5: fee_rule_schedule_base must be service-role only';
  END IF;
  IF has_function_privilege('anon', 'public.fee_rule_cancel_scheduled(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fee_rule_cancel_scheduled(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'fee engine PR 5: fee_rule_cancel_scheduled must be service-role only';
  END IF;
END $$;

-- ── ROLLBACK ──────────────────────────────────────────────────────────────
--   DROP FUNCTION IF EXISTS public.fee_rule_schedule_base(uuid, numeric, timestamptz, text, uuid);
--   DROP FUNCTION IF EXISTS public.fee_rule_cancel_scheduled(uuid);
