-- ============================================================================
-- LOCAL-STACK SEED — fee_rules pair-scope rows for the reseeded catalogue.
-- Run by `pnpm test:reset` (scripts/local-stack.mjs) AFTER `supabase db reset`
-- and `pnpm seed:games --env=local`. Never applied to production: production
-- already had its catalogue when the fee migrations ran.
--
-- WHY A SEED AND NOT THE MIGRATIONS. The two fee migrations write pair-scope
-- rules keyed through game_categories. On a fresh stack `db reset` applies
-- them while game_categories is still EMPTY (the catalogue comes from
-- seed:games, a node script), so they seed the category defaults and no pair
-- rows. The old recipe re-ran both migration files by hand afterwards. This
-- file writes the SAME end state directly, for local stacks only:
--
--   20260921201844_fee_engine_seed_current_rates  → 'Seed:' pair rules
--       (Roblox-economy currency 10 %, GTA accounts 20 %) from 2026-01-01,
--       which 20260922001513 then CLOSED at the PR 4 start → written here
--       already closed: [2026-01-01, v_start).
--   20260922001513_fee_engine_rates_2026_10      → 'PR4:' pair rules from
--       v_start, and the 0 % promos for [v_start, v_start + 6 months).
--
-- v_start is READ from the PR 4 category rows the migration wrote, so this
-- file never re-decides the start date. Rows, notes and pct are identical to
-- what the migrations produce; fee-migration-parity.guard restates the spec
-- independently and fails if this file and the migrations ever diverge.
--
-- WHEN YOU ADD A FEE MIGRATION THAT KEYS RULES BY PAIR: add its local-stack
-- rows here too, or `pnpm test:reset` reports resolver gaps / the parity
-- guards fail on a fresh stack.
--
-- IDEMPOTENT: every insert is NOT EXISTS-guarded; re-running adds nothing.
-- Runs under app.fee_backfill (historical starts_at) — a psql session as the
-- postgres role is a caller guarded_write_allowed() trusts.
-- ============================================================================

DO $$
DECLARE
  v_seed       constant timestamptz := timestamptz '2026-01-01 00:00:00+00';
  v_start      timestamptz;
  v_promo_end  timestamptz;
  v_n          integer;
  v_pr1        integer := 0;
  v_pr4        integer := 0;
  v_promo      integer := 0;
BEGIN
  PERFORM set_config('app.fee_backfill', 'on', true);

  SELECT min(fr.starts_at) INTO v_start
    FROM public.fee_rules fr
   WHERE fr.note LIKE 'PR4:%' AND fr.kind = 'base' AND fr.scope = 'category';
  IF v_start IS NULL THEN
    RAISE EXCEPTION 'fee seed: no PR 4 category rows — migration 20260922001513 is not applied on this stack';
  END IF;
  v_promo_end := v_start + interval '6 months';

  -- ── 1. PR 1 era pair rules, closed at the PR 4 start (20260921201844 §2) ─
  INSERT INTO public.fee_rules (kind, scope, category_type, game_category_id, pct, starts_at, ends_at, note)
  SELECT 'base', 'game_category', gc.type, gc.id, s.pct, v_seed, v_start, s.note
    FROM (VALUES
      ('currency', 10.00, ARRAY['steal-a-brainrot','grow-a-garden','grow-a-garden-2'],
       'Seed: lib/fees ROBLOX_ECONOMY_GAMES → currencyRobloxEconomy 10%'),
      ('account',  20.00, ARRAY['gta-v','gtavi','gta-6'],
       'Seed: lib/fees ACCOUNT_RISK_BANDS high → accounts 20%')
    ) AS s(category_type, pct, slugs, note)
    JOIN public.game_categories gc ON gc.type = s.category_type
    JOIN public.games g ON g.id = gc.game_id AND lower(g.slug) = ANY (s.slugs)
   WHERE NOT EXISTS (SELECT 1 FROM public.fee_rules fr
                      WHERE fr.kind = 'base' AND fr.game_category_id = gc.id AND fr.starts_at = v_seed);
  GET DIAGNOSTICS v_pr1 = ROW_COUNT;

  -- ── 2. PR 4 pair rules from the start (20260922001513 §4) ───────────────
  INSERT INTO public.fee_rules (kind, scope, category_type, game_category_id, pct, starts_at, note)
  SELECT 'base', 'game_category', gc.type, gc.id, l.pct, v_start,
         'PR4: ' || g.slug || ' ' || gc.type || ' ' || l.pct::text
    FROM (VALUES
      ('currency', 10.00, ARRAY['anime-defenders','blade-ball','creatures-of-sonaria','death-ball',
                                'dragon-adventures','escape-tsunami-for-brainrots','fisch','fix-it-up',
                                'grow-a-garden','grow-a-garden-2','pet-simulator-99','pets-go','royale-high',
                                'tap-simulator','toilet-tower-defense','steal-a-brainrot']),
      ('account',  15.00, ARRAY['call-of-duty','fortnite','r6-siege']),
      ('account',  20.00, ARRAY['gta-v','gtavi','gta-6','gta-vi']),
      ('service',  15.00, ARRAY['call-of-duty']),
      ('top_up',   10.00, ARRAY['99-nights-in-the-forest','bite-by-night','bloxstrike','run-a-restaurant','sniper-duels'])
    ) AS l(category_type, pct, slugs)
    JOIN public.game_categories gc ON gc.type = l.category_type
    JOIN public.games g ON g.id = gc.game_id AND lower(g.slug) = ANY (l.slugs)
   WHERE NOT EXISTS (SELECT 1 FROM public.fee_rules fr
                      WHERE fr.kind = 'base' AND fr.game_category_id = gc.id AND fr.starts_at = v_start);
  GET DIAGNOSTICS v_pr4 = ROW_COUNT;

  -- ── 3. PR 4 promos: 0 % on R6 Credits / FC Points (20260922001513 §5) ───
  INSERT INTO public.fee_rules (kind, scope, category_type, game_category_id, pct, starts_at, ends_at, note)
  SELECT 'promo', 'game_category', gc.type, gc.id, 0.00, v_start, v_promo_end,
         'PR4: promo ' || g.slug || ' ' || gc.type || ' 0'
    FROM public.game_categories gc
    JOIN public.games g ON g.id = gc.game_id
   WHERE gc.type IN ('top_up', 'currency')
     AND lower(g.slug) = ANY (ARRAY['r6-siege','fc-25','fc-26','ea-sports-fc-26'])
     AND NOT EXISTS (SELECT 1 FROM public.fee_rules fr
                      WHERE fr.kind = 'promo' AND fr.game_category_id = gc.id AND fr.note LIKE 'PR4: promo %');
  GET DIAGNOSTICS v_promo = ROW_COUNT;

  -- ── 4. Proof: no pair resolves through the fallback, before or after the start
  SELECT count(*) INTO v_n
    FROM public.game_categories gc
   WHERE (SELECT r.rule_id FROM public.resolve_seller_fee(NULL, gc.id, v_start - interval '1 second') r) IS NULL
      OR (SELECT r.rule_id FROM public.resolve_seller_fee(NULL, gc.id, v_start) r) IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'fee seed: % pair(s) still resolve through the fallback', v_n;
  END IF;

  RAISE NOTICE 'fee seed: +% PR 1 pair rule(s), +% PR 4 pair rule(s), +% promo(s); start %', v_pr1, v_pr4, v_promo, v_start;
END $$;
