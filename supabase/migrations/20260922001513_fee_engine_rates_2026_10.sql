-- ============================================================================
-- FEE ENGINE — PR 4: THE NEW RATES                        (fee-engine.md §6, PR 4 row)
--
-- DATA ONLY. No schema, no function, no grant changes. One dated event:
--   · every open-ended base rule from the PR 1 seed is CLOSED at v_start
--     (ends_at = v_start; '[)' ranges make the hand-over gap-free), and
--   · the target-model base rules are inserted starting AT v_start, so
--   · every pair resolves to TODAY's rate up to v_start − 1s and to the table
--     below from v_start on (pinned by fee-migration-parity.guard).
--
-- THE 14-DAY NOTICE IS ENFORCED BY THE TRIGGER, NOT WAIVED. The new base rows
-- are inserted with app.fee_backfill OFF, so fee_rules_enforce_notice()
-- validates each one (a start inside the notice window is refused and the
-- whole transaction rolls back — nothing is half-applied). The GUC is set ON
-- for exactly one statement: closing the PR 1 rows, because the trigger
-- re-checks starts_at (2026-01-01) on UPDATE and would otherwise refuse to
-- let a historical rule end. Promos are exempt from the notice by design.
--
-- START DATE. Announced floor: 2026-10-06 00:00 UTC. The trigger requires
-- starts_at ≥ now() + notice_days, so the effective start is the first
-- 00:00 UTC on or after now() + notice, never earlier than the floor:
--   pushed 2026-09-22 → starts 2026-10-07;  pushed 2026-09-23 → 2026-10-08; …
-- The push prints `NOTICE: fee engine PR 4: rates start at <ts>` — THAT is the
-- date to announce. Afterwards: SELECT min(starts_at) FROM fee_rules WHERE
-- note LIKE 'PR4:%'. Promos run [v_start, v_start + 6 months).
--
-- RATES (seller commission on the item price; category scope unless a pair
-- is listed; pair rows are keyed through game_categories, never a slug):
--   items 10 · service 10 · top_up 5 · gift_card 5 (7→5 correction, audit M9)
--   currency 5 · account 10
--   currency 10 : the Roblox-economy list below (16 slugs)
--   account  15 : call-of-duty, fortnite, r6-siege
--   account  20 : gta-v, gtavi, gta-6, gta-vi (the catalogue's slug for GTA 6)
--   service  15 : call-of-duty
--   top_up   10 : 99-nights-in-the-forest, bite-by-night, bloxstrike,
--                 run-a-restaurant, sniper-duels
--   PROMO 0%    : R6 Credits / FC Points — the top_up (or currency) pair of
--                 r6-siege, fc-25, fc-26, ea-sports-fc-26; never an account pair
-- A slug whose (game, type) pair does not exist is SKIPPED and printed in a
-- NOTICE (matched / missing per list) — read the push output.
--
-- RANK LADDER + FOUNDING are single-row / undated tables, so they apply AT
-- PUSH TIME (fee-engine.md §1.2): bronze 0 · silver 0.5 · gold 1.0 ·
-- diamond 1.5 · legendary 2.0 points off a base ABOVE the floor (8.00); a 5%
-- or 7% base is never touched. Founding 50% for 12 months (unchanged).
--
-- IDEMPOTENT for the local-stack case only: after `supabase db reset` +
-- `pnpm seed:games --env=local`, re-apply this file once (after re-applying
-- the PR 1 seed) so the pair rules exist for the reseeded pairs. A re-run
-- detects the PR 4 category rows, reuses THEIR starts_at and runs under
-- app.fee_backfill like the PR 1 seed (the notice was enforced on the first
-- application; a dev re-seed weeks later must not be refused). Production is
-- applied once, by `supabase db push`.
--
-- ROLLBACK (fee-engine.md §6.2) — BEFORE v_start it is a clean no-op:
--   DELETE FROM public.fee_rules WHERE note LIKE 'PR4:%';
--   -- re-open the PR 1 rows (psql, app.fee_backfill = 'on'):
--   UPDATE public.fee_rules SET ends_at = NULL WHERE note LIKE 'Seed:%' AND kind = 'base';
--   UPDATE public.seller_tier_config SET discount_pts = 0;
-- AFTER v_start the rollback is a NEW dated rule set (same 14-day notice).
-- ============================================================================

DO $$
DECLARE
  v_floor_date  constant timestamptz := timestamptz '2026-10-06 00:00:00+00';
  v_notice      integer;
  v_start       timestamptz;
  v_existing    timestamptz;
  v_promo_end   timestamptz;
  v_reseed      boolean := false;
  v_closed      integer;
  v_n           integer;
  v_pairs       integer;
  v_bad         text;
  v_list        text[];
  v_matched     text[];
  v_missing     text[];
  lst           record;
BEGIN
  -- ── 0. The effective start ─────────────────────────────────────────────
  SELECT base_change_notice_days INTO v_notice FROM public.platform_fee_settings WHERE id;
  v_notice := COALESCE(v_notice, 14);
  -- first 00:00 UTC on/after now() + notice, floored at the announced date
  v_start := GREATEST(v_floor_date,
                      date_trunc('day', (now() + make_interval(days => v_notice)) AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
                        + interval '1 day');

  -- Re-application (local stack re-seed): reuse the first run's start date
  -- and stand the notice trigger aside, exactly like the PR 1 seed file.
  SELECT fr.starts_at INTO v_existing
    FROM public.fee_rules fr
   WHERE fr.note LIKE 'PR4:%' AND fr.kind = 'base' AND fr.scope = 'category'
   ORDER BY fr.starts_at LIMIT 1;
  IF v_existing IS NOT NULL THEN
    v_start  := v_existing;
    v_reseed := true;
    PERFORM set_config('app.fee_backfill', 'on', true);
    RAISE NOTICE 'fee engine PR 4: already applied (start %) — re-seed mode, adding pair rules for new pairs only', v_start;
  END IF;

  v_promo_end := v_start + interval '6 months';

  -- ── 1. Money-neutral-until-start: remember what every pair resolves to
  --      just before v_start, BEFORE any write. Re-checked in step 7.
  DROP TABLE IF EXISTS pr4_before;
  CREATE TEMP TABLE pr4_before ON COMMIT DROP AS
    SELECT gc.id AS pair_id, r.pct, r.rule_id
      FROM public.game_categories gc
      CROSS JOIN LATERAL public.resolve_seller_fee(NULL, gc.id, v_start - interval '1 second') r;

  -- ── 2. Close every open-ended base rule at v_start ─────────────────────
  -- The notice trigger re-checks starts_at on UPDATE (a 2026-01-01 row can
  -- never pass), so the backfill GUC is ON for THIS statement only.
  PERFORM set_config('app.fee_backfill', 'on', true);
  UPDATE public.fee_rules
     SET ends_at = v_start
   WHERE kind = 'base' AND ends_at IS NULL AND starts_at < v_start;
  GET DIAGNOSTICS v_closed = ROW_COUNT;
  IF NOT v_reseed THEN
    PERFORM set_config('app.fee_backfill', 'off', true);
  END IF;
  RAISE NOTICE 'fee engine PR 4: closed % open-ended base rule(s) at %', v_closed, v_start;

  -- ── 3. Category-scope base rules — validated by the notice trigger ─────
  INSERT INTO public.fee_rules (kind, scope, category_type, game_category_id, pct, starts_at, note)
  SELECT 'base', 'category', t.category_type, NULL, t.pct, v_start, 'PR4: category default ' || t.category_type
    FROM (VALUES
      ('items',     10.00),
      ('service',   10.00),
      ('top_up',     5.00),
      ('gift_card',  5.00),
      ('currency',   5.00),
      ('account',   10.00)
    ) AS t(category_type, pct)
   WHERE NOT EXISTS (SELECT 1 FROM public.fee_rules fr
                      WHERE fr.kind = 'base' AND fr.scope = 'category'
                        AND fr.category_type = t.category_type AND fr.starts_at = v_start);

  -- ── 4. Pair-scope base rules, per list. Skips missing pairs, reports. ──
  FOR lst IN SELECT * FROM (VALUES
    ('currency', 10.00, ARRAY['anime-defenders','blade-ball','creatures-of-sonaria','death-ball',
                              'dragon-adventures','escape-tsunami-for-brainrots','fisch','fix-it-up',
                              'grow-a-garden','grow-a-garden-2','pet-simulator-99','pets-go','royale-high',
                              'tap-simulator','toilet-tower-defense','steal-a-brainrot']),
    ('account',  15.00, ARRAY['call-of-duty','fortnite','r6-siege']),
    ('account',  20.00, ARRAY['gta-v','gtavi','gta-6','gta-vi']),
    ('service',  15.00, ARRAY['call-of-duty']),
    ('top_up',   10.00, ARRAY['99-nights-in-the-forest','bite-by-night','bloxstrike','run-a-restaurant','sniper-duels'])
  ) AS l(category_type, pct, slugs)
  LOOP
    INSERT INTO public.fee_rules (kind, scope, category_type, game_category_id, pct, starts_at, note)
    SELECT 'base', 'game_category', gc.type, gc.id, lst.pct, v_start,
           'PR4: ' || g.slug || ' ' || gc.type || ' ' || lst.pct::text
      FROM public.game_categories gc
      JOIN public.games g ON g.id = gc.game_id
     WHERE gc.type = lst.category_type
       AND lower(g.slug) = ANY (lst.slugs)
       AND NOT EXISTS (SELECT 1 FROM public.fee_rules fr
                        WHERE fr.kind = 'base' AND fr.game_category_id = gc.id AND fr.starts_at = v_start);

    SELECT array_agg(g.slug ORDER BY g.slug) INTO v_matched
      FROM public.game_categories gc JOIN public.games g ON g.id = gc.game_id
     WHERE gc.type = lst.category_type AND lower(g.slug) = ANY (lst.slugs);
    SELECT array_agg(s ORDER BY s) INTO v_missing
      FROM unnest(lst.slugs) s
     WHERE NOT (s = ANY (COALESCE(v_matched, '{}')));
    RAISE NOTICE 'fee engine PR 4: % at % pct — matched % · missing (no such pair, skipped) %',
      lst.category_type, lst.pct, COALESCE(v_matched, '{}'), COALESCE(v_missing, '{}');
  END LOOP;

  -- ── 5. Promos: 0% on R6 Credits / FC Points for six months ─────────────
  -- Both are bought-with-real-money in-game currencies, which this catalogue
  -- files under `top_up` (EA Sports FC 26 → top-up pair; the game has no
  -- `currency` pair). Matched by (slug, type ∈ top_up|currency) so a future
  -- `currency` pair for the same game would also qualify; NEVER the account
  -- pair. r6-siege has only an account pair today → reported, skipped.
  -- kind=promo is exempt from the notice trigger and from the exclusion
  -- constraint; guarded by note so a re-run cannot duplicate.
  v_list := ARRAY['r6-siege','fc-25','fc-26','ea-sports-fc-26'];
  INSERT INTO public.fee_rules (kind, scope, category_type, game_category_id, pct, starts_at, ends_at, note)
  SELECT 'promo', 'game_category', gc.type, gc.id, 0.00, v_start, v_promo_end,
         'PR4: promo ' || g.slug || ' ' || gc.type || ' 0'
    FROM public.game_categories gc
    JOIN public.games g ON g.id = gc.game_id
   WHERE gc.type IN ('top_up', 'currency')
     AND lower(g.slug) = ANY (v_list)
     AND NOT EXISTS (SELECT 1 FROM public.fee_rules fr
                      WHERE fr.kind = 'promo' AND fr.game_category_id = gc.id AND fr.note LIKE 'PR4: promo %');
  SELECT array_agg(g.slug || '/' || gc.type ORDER BY g.slug, gc.type) INTO v_matched
    FROM public.game_categories gc JOIN public.games g ON g.id = gc.game_id
   WHERE gc.type IN ('top_up', 'currency') AND lower(g.slug) = ANY (v_list);
  SELECT array_agg(s ORDER BY s) INTO v_missing FROM unnest(v_list) s
   WHERE NOT EXISTS (SELECT 1 FROM public.game_categories gc JOIN public.games g ON g.id = gc.game_id
                      WHERE gc.type IN ('top_up', 'currency') AND lower(g.slug) = s);
  RAISE NOTICE 'fee engine PR 4: promo 0 pct [%, %) — matched % · missing (no top_up/currency pair, skipped) %',
    v_start, v_promo_end, COALESCE(v_matched, '{}'), COALESCE(v_missing, '{}');

  -- ── 6. Rank ladder + platform settings (undated → effective at push) ───
  UPDATE public.seller_tier_config
     SET discount_pts = CASE tier
           WHEN 'bronze'    THEN 0.00
           WHEN 'silver'    THEN 0.50
           WHEN 'gold'      THEN 1.00
           WHEN 'diamond'   THEN 1.50
           WHEN 'legendary' THEN 2.00
           ELSE discount_pts
         END;
  SELECT string_agg(t, ', ') INTO v_bad
    FROM unnest(ARRAY['bronze','silver','gold','diamond','legendary']) t
   WHERE NOT EXISTS (SELECT 1 FROM public.seller_tier_config stc WHERE stc.tier = t);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'fee engine PR 4: seller_tier_config has no row for tier(s) % — the rank ladder cannot be applied', v_bad;
  END IF;

  UPDATE public.platform_fee_settings
     SET rank_floor_pct        = 8.00,
         founding_discount_pct = 50.00,
         founding_months       = 12,
         updated_at            = now()
   WHERE id;

  -- ── 7. Proofs — refuse to finish in any other state ────────────────────
  -- (a) exactly the six category defaults are open-ended, all starting at v_start
  SELECT count(*) INTO v_n FROM public.fee_rules
   WHERE kind = 'base' AND scope = 'category' AND ends_at IS NULL;
  IF v_n <> 6 THEN
    RAISE EXCEPTION 'fee engine PR 4: expected 6 open-ended category base rules, found %', v_n;
  END IF;
  IF EXISTS (SELECT 1 FROM public.fee_rules WHERE kind = 'base' AND ends_at IS NULL AND starts_at <> v_start) THEN
    RAISE EXCEPTION 'fee engine PR 4: an open-ended base rule does not start at %', v_start;
  END IF;
  SELECT string_agg(category_type || '=' || pct::text, ', ' ORDER BY category_type) INTO v_bad
    FROM public.fee_rules
   WHERE kind = 'base' AND scope = 'category' AND starts_at = v_start
     AND NOT (
       (category_type = 'items'     AND pct = 10.00) OR (category_type = 'service'  AND pct = 10.00) OR
       (category_type = 'top_up'    AND pct =  5.00) OR (category_type = 'gift_card' AND pct = 5.00) OR
       (category_type = 'currency'  AND pct =  5.00) OR (category_type = 'account'  AND pct = 10.00));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'fee engine PR 4: category defaults are wrong: %', v_bad;
  END IF;

  -- (b) nothing changed before v_start: every pair resolves exactly as it did
  --     before this transaction, and never through the fallback
  SELECT count(*) INTO v_n
    FROM pr4_before b
    CROSS JOIN LATERAL public.resolve_seller_fee(NULL, b.pair_id, v_start - interval '1 second') r
   WHERE r.pct IS DISTINCT FROM b.pct OR r.rule_id IS DISTINCT FROM b.rule_id OR r.rule_id IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'fee engine PR 4: % pair(s) resolve differently before % than they did before this migration', v_n, v_start;
  END IF;

  -- (c) from v_start every pair resolves to the table: its PR4 pair rule if
  --     one exists, else the PR4 category default; never the fallback
  SELECT count(*) INTO v_n
    FROM public.game_categories gc
    CROSS JOIN LATERAL public.resolve_seller_fee(NULL, gc.id, v_start) r
    LEFT JOIN public.fee_rules pr ON pr.kind = 'base' AND pr.game_category_id = gc.id AND pr.starts_at = v_start
    LEFT JOIN public.fee_rules cr ON cr.kind = 'base' AND cr.scope = 'category' AND cr.category_type = gc.type AND cr.starts_at = v_start
   WHERE r.rule_id IS NULL
      OR (r.rule_kind = 'base' AND r.rule_id IS DISTINCT FROM COALESCE(pr.id, cr.id))
      OR (r.rule_kind = 'base' AND r.pct IS DISTINCT FROM COALESCE(pr.pct, cr.pct));
  IF v_n > 0 THEN
    RAISE EXCEPTION 'fee engine PR 4: % pair(s) do not resolve to the new table at %', v_n, v_start;
  END IF;

  -- (d) every promo row is bounded to [v_start, v_start + 6 months) at 0
  IF EXISTS (SELECT 1 FROM public.fee_rules
              WHERE note LIKE 'PR4: promo %'
                AND (kind <> 'promo' OR pct <> 0 OR starts_at <> v_start OR ends_at <> v_promo_end
                     OR category_type NOT IN ('top_up', 'currency'))) THEN
    RAISE EXCEPTION 'fee engine PR 4: a promo row is outside [%, %), not 0 pct, or on a non-currency pair', v_start, v_promo_end;
  END IF;
  --     …and each promo pair resolves to 0 from the start and to its base again after the promo
  SELECT count(*) INTO v_n
    FROM public.fee_rules pr
    CROSS JOIN LATERAL public.resolve_seller_fee(NULL, pr.game_category_id, v_start) r0
    CROSS JOIN LATERAL public.resolve_seller_fee(NULL, pr.game_category_id, v_promo_end) r1
   WHERE pr.note LIKE 'PR4: promo %'
     AND (r0.pct <> 0 OR r0.rule_id <> pr.id OR r0.rule_kind <> 'promo' OR r1.rule_kind <> 'base' OR r1.pct = 0);
  IF v_n > 0 THEN
    RAISE EXCEPTION 'fee engine PR 4: % promo pair(s) do not resolve to 0 at % and back to base at %', v_n, v_start, v_promo_end;
  END IF;

  SELECT count(*) INTO v_pairs FROM public.fee_rules WHERE note LIKE 'PR4:%' AND scope = 'game_category' AND kind = 'base';
  SELECT count(*) INTO v_n     FROM public.fee_rules WHERE note LIKE 'PR4: promo %';
  RAISE NOTICE 'fee engine PR 4: rates start at % — 6 category defaults, % pair rule(s), % promo(s); ladder 0/0.5/1/1.5/2, floor 8, founding 50 pct × 12 mo (ladder + settings effective now)',
    v_start, v_pairs, v_n;
END $$;
