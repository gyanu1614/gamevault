-- ============================================================================
-- FEE ENGINE — PR 1 / STEP 2: seed fee_rules from the CURRENT ENFORCED TS RATES
--                                                          (fee-engine.md §6.1)
--
-- THE MONEY-NEUTRALITY STEP. After this, resolve_seller_fee(NULL, pair) returns,
-- for every catalogue pair, EXACTLY what src/lib/fees commissionPct() charges
-- today — so switching checkout to the resolver (PR 3) changes nobody's
-- take-home. Pinned by src/test/guards/fee-migration-parity.guard.
--
-- Rates seeded are what src/lib/fees/index.ts ENFORCES, not what /fees
-- PUBLISHES:
--   currency 5 · items 7 · account 15 · top_up 5 · service 7 · gift_card 7
--   + Roblox-economy currency pairs 10 (steal-a-brainrot, grow-a-garden, grow-a-garden-2)
--   + GTA account pairs 20 (gta-v, gtavi, gta-6)
-- service AND gift_card seed at 7.00, NOT 5.00: classifyOfferType sends both
-- to the `items` branch today (audit M9). Correcting gift cards to 5% is a
-- RATE DECISION and belongs in PR 4.
--
-- APPROVED (overrides the draft): no legacy_founding_pts. Founding = 50% off
-- for 12 months from founding_since, backfilled here to profiles.created_at
-- for EVERY existing founding seller. (Founding sellers are the one group for
-- whom PR 3 is NOT money-neutral — today's TS gives base − 2 pts for life —
-- and that is the owner's decision, recorded in the PR body.)
--
-- IDEMPOTENT: every INSERT is ON CONFLICT DO NOTHING (the exclusion
-- constraint is a usable arbiter for DO NOTHING without a target), so the
-- file can be re-applied — e.g. on a local stack after `pnpm seed:games
-- --env=local` has created the pairs the pair-scope rules need:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f <this file>
--
-- ONE DO block so app.fee_backfill (transaction-local) and every write share
-- a transaction regardless of how the file is applied. The notice trigger
-- honours the GUC only for a caller guarded_write_allowed() trusts (a
-- migration session qualifies: auth.role() IS NULL).
-- ============================================================================

DO $$
DECLARE
  v_gaps  integer;
  v_cats  integer;
  v_seed  constant timestamptz := timestamptz '2026-01-01 00:00:00+00';
BEGIN
  -- Historical starts_at is the whole point of the seed, so the 14-day notice
  -- trigger must stand aside for THIS transaction only.
  PERFORM set_config('app.fee_backfill', 'on', true);
  -- profiles.founding_since is a guarded column (a migration session passes
  -- guarded_write_allowed() anyway; explicit for a psql re-run under a JWT).
  PERFORM set_config('app.guarded_write', 'on', true);

  -- ── 1. Category-scope base rules (the platform default per type) ─────────
  INSERT INTO public.fee_rules (kind, scope, category_type, game_category_id, pct, starts_at, note)
  VALUES
    ('base', 'category', 'currency',  NULL,  5.00, v_seed, 'Seed: lib/fees COMMISSION_PCT.currencyStandard (money-neutral cutover)'),
    ('base', 'category', 'items',     NULL,  7.00, v_seed, 'Seed: lib/fees COMMISSION_PCT.items'),
    ('base', 'category', 'account',   NULL, 15.00, v_seed, 'Seed: lib/fees COMMISSION_PCT.accounts.mid (every non-GTA game today)'),
    ('base', 'category', 'top_up',    NULL,  5.00, v_seed, 'Seed: lib/fees COMMISSION_PCT.topUp'),
    ('base', 'category', 'service',   NULL,  7.00, v_seed, 'Seed: classifyOfferType sends service → items branch = 7% today'),
    ('base', 'category', 'gift_card', NULL,  7.00, v_seed, 'Seed: classifyOfferType sends gift_card → items branch = 7% today (audit M9). Corrected in PR 4.')
  ON CONFLICT DO NOTHING;

  -- ── 2. Pair-scope base rules — the two per-game exceptions in TS today ───
  -- Keyed through game_categories (the pair table), never a game_slug string.
  -- Roblox in-game economies: currency at 10% (lib/fees ROBLOX_ECONOMY_GAMES).
  INSERT INTO public.fee_rules (kind, scope, category_type, game_category_id, pct, starts_at, note)
  SELECT 'base', 'game_category', gc.type, gc.id, 10.00, v_seed,
         'Seed: lib/fees ROBLOX_ECONOMY_GAMES → currencyRobloxEconomy 10%'
  FROM public.game_categories gc
  JOIN public.games g ON g.id = gc.game_id
  WHERE gc.type = 'currency'
    AND lower(g.slug) IN ('steal-a-brainrot', 'grow-a-garden', 'grow-a-garden-2')
  ON CONFLICT DO NOTHING;

  -- High-risk account games: accounts at 20% (lib/fees ACCOUNT_RISK_BANDS high).
  INSERT INTO public.fee_rules (kind, scope, category_type, game_category_id, pct, starts_at, note)
  SELECT 'base', 'game_category', gc.type, gc.id, 20.00, v_seed,
         'Seed: lib/fees ACCOUNT_RISK_BANDS high → accounts 20%'
  FROM public.game_categories gc
  JOIN public.games g ON g.id = gc.game_id
  WHERE gc.type = 'account'
    AND lower(g.slug) IN ('gta-v', 'gtavi', 'gta-6')
  ON CONFLICT DO NOTHING;

  -- ── 3. Rank steps stay at ZERO (ranks have never affected money; the real
  --      0/0.5/1.0/1.5/2.0 ladder is PR 4 data). Settings = the programme terms.
  UPDATE public.seller_tier_config SET discount_pts = 0;

  UPDATE public.platform_fee_settings
     SET rank_floor_pct          = 8.00,
         founding_discount_pct   = 50.00,
         founding_months         = 12,
         base_change_notice_days = 14,
         updated_at              = now()
   WHERE id;

  -- ── 4. Founding backfill: every existing founding seller's 12-month clock
  --      starts at their profile creation (approved decision).
  UPDATE public.profiles
     SET founding_since = created_at
   WHERE founding_seller = true
     AND founding_since IS NULL;

  -- ── 5. Proof — the seed must reproduce today's rates; refuse otherwise ───
  SELECT count(*) INTO v_cats
    FROM public.fee_rules
   WHERE kind = 'base' AND scope = 'category' AND ends_at IS NULL;
  IF v_cats <> 6 THEN
    RAISE EXCEPTION 'fee engine seed: expected 6 open-ended category base rules, found %', v_cats;
  END IF;

  -- No pair may resolve through the 2e fallback.
  SELECT count(*) INTO v_gaps
    FROM public.game_categories gc
   WHERE (SELECT r.rule_id FROM public.resolve_seller_fee(NULL, gc.id) r) IS NULL;
  IF v_gaps > 0 THEN
    RAISE EXCEPTION 'fee engine seed: % game_categories pair(s) still resolve through the fallback', v_gaps;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE founding_seller = true AND founding_since IS NULL) THEN
    RAISE EXCEPTION 'fee engine seed: a founding seller is left without founding_since';
  END IF;
END $$;

-- Parity with commissionPct() for every catalogue pair (Roblox-economy
-- currency 10, GTA accounts 20, everything else by type) is asserted by
-- src/test/guards/fee-migration-parity.guard.integration.test.ts.

-- ── ROLLBACK ──────────────────────────────────────────────────────────────
--   DELETE FROM public.fee_rules WHERE note LIKE 'Seed:%';
--   UPDATE public.profiles SET founding_since = NULL WHERE founding_seller = true;
--     (run under app.guarded_write = 'on' from a psql session)
