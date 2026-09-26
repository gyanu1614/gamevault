-- ============================================================================
-- FEE ENGINE — PR 1 / STEP 1: schema + resolver           (fee-engine.md §1, §2)
--
-- Money effect: NONE. Nothing reads any of this yet; checkout still prices
-- from src/lib/fees. The companion seed (next migration) makes the resolver
-- return today's enforced rates for every catalogue pair, so the later
-- checkout switch (PR 3) is a no-op for every seller.
--
-- Approved deviations from docs/design/fee-engine-draft.sql:
--   · Founding = 50% off the BASE for 12 months (founding_months default 12,
--     was 6), anchored on COALESCE(profiles.founding_since, profiles.created_at)
--     so EVERY founding seller — past or future grant — is covered without an
--     app change. The "2 points for life" legacy branch and
--     platform_fee_settings.legacy_founding_pts are RETIRED (not created).
--   · The resolver trace gains fallback_count (0|1) and resolver_version (1),
--     and a view fee_resolution_gaps lists engine-era orders that resolved
--     through the hard-coded fallback, so the silent default can be alerted on.
--   · Rank steps stay data (seller_tier_config.discount_pts), seeded 0 here.
--   · DLT-005 (20260921005842) revoked the TABLES default privilege, so the two
--     public-read tables carry an explicit GRANT SELECT to anon/authenticated.
--
-- CONVENTIONS (CLAUDE.md): every SECURITY DEFINER function pins
-- SET search_path = public; new functions are service-role-only unless
-- explicitly granted AND allow-listed in db-p0-grants.guard; views are
-- security_invoker; game_categories is the only category table referenced.
-- ============================================================================

-- ── 0. Marker (repo pattern: present ⇒ this migration is applied) ─────────
CREATE OR REPLACE FUNCTION public.fee_engine_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.fee_engine_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fee_engine_version() TO service_role;

-- ── 1. Extension: btree_gist gives GiST `=` on text/uuid for the exclusion
--      constraint below (alongside tstzrange &&). Default opclass lookup is
--      schema-independent, so the Supabase `extensions` schema is fine.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- ── 2. fee_rules — the dated rate table ───────────────────────────────────
-- Replaces category_fee_config + game_fee_overrides as the source of truth.
-- Both legacy tables are LEFT IN PLACE (dormant, no reader) until PR 6.
CREATE TABLE IF NOT EXISTS public.fee_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WHAT the rule prices
  kind             text NOT NULL CHECK (kind IN ('base', 'promo')),
  scope            text NOT NULL CHECK (scope IN ('category', 'game_category')),
  category_type    text NOT NULL
                   CHECK (category_type IN ('currency', 'items', 'account',
                                            'top_up', 'service', 'gift_card')),
  game_category_id uuid REFERENCES public.game_categories(id) ON DELETE CASCADE,

  -- THE RATE (numeric percent, 2dp — fee-engine.md §1.0 for why not bps)
  pct              numeric(5,2) NOT NULL CHECK (pct >= 0 AND pct <= 50),

  -- WHEN it applies. '[)' so back-to-back rules do not overlap.
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz,
  validity         tstzrange GENERATED ALWAYS AS
                     (tstzrange(starts_at, ends_at, '[)')) STORED,

  -- PROVENANCE
  note             text,
  created_by       uuid REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- SHAPE INVARIANTS
  CONSTRAINT fee_rules_scope_shape CHECK (
    (scope = 'category'      AND game_category_id IS NULL) OR
    (scope = 'game_category' AND game_category_id IS NOT NULL)
  ),
  CONSTRAINT fee_rules_window_ordered CHECK (ends_at IS NULL OR ends_at > starts_at),
  -- An unbounded promo is a base rate in disguise and would dodge the 14-day
  -- notice rule that only exempts promos.
  CONSTRAINT fee_rules_promo_bounded  CHECK (kind = 'base' OR ends_at IS NOT NULL)
);

COMMENT ON TABLE public.fee_rules IS
  'Seller-commission rates, dated. kind=base is the standing rate; kind=promo is a bounded override that wins over base. Resolved ONLY through resolve_seller_fee(); never read directly by app code.';
COMMENT ON COLUMN public.fee_rules.game_category_id IS
  'FK to the (game, category) pair. NULL = platform-wide rule for category_type. Never a game_slug: a free-text key cannot be joined and orphans silently on rename (the legacy game_fee_overrides mistake).';
COMMENT ON COLUMN public.fee_rules.pct IS
  'Percent, numeric(5,2). Applies to the ITEM PRICE only, never to the buyer fee.';
COMMENT ON COLUMN public.fee_rules.validity IS
  'Generated STORED so it cannot drift from starts_at/ends_at, and so GiST can index it for the exclusion constraint.';

-- Base rules for one key may never overlap in time. Promos MAY overlap (each
-- other and a base) — resolved deterministically by precedence in
-- resolve_seller_fee. COALESCE collapses both scopes into one key expression:
-- category-scope rows share the nil sentinel; pair rows compare per pair. A
-- category base and a pair base for the same type CAN coexist — precedence,
-- not conflict.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_rules_no_overlapping_base') THEN
    ALTER TABLE public.fee_rules ADD CONSTRAINT fee_rules_no_overlapping_base
      EXCLUDE USING gist (
        category_type WITH =,
        (COALESCE(game_category_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
        validity WITH &&
      ) WHERE (kind = 'base');
  END IF;
END $$;

-- The two resolver lookups, exactly (fee-engine.md §8.1).
CREATE INDEX IF NOT EXISTS fee_rules_pair_lookup
  ON public.fee_rules (game_category_id, starts_at DESC)
  WHERE game_category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fee_rules_category_lookup
  ON public.fee_rules (category_type, starts_at DESC)
  WHERE game_category_id IS NULL;

-- Fees are PUBLIC information (quoted on the fee page and the sell wizard).
-- No write policy on purpose → every write goes through the admin action's
-- service-role client. DLT-005 closed the TABLES default grant, so the read
-- grant is explicit; writes are revoked explicitly too.
ALTER TABLE public.fee_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fee_rules_read_all ON public.fee_rules;
CREATE POLICY fee_rules_read_all ON public.fee_rules FOR SELECT USING (true);
REVOKE ALL ON TABLE public.fee_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.fee_rules TO anon, authenticated;

-- ── 3. platform_fee_settings — one row, platform-wide knobs ───────────────
-- `id boolean PRIMARY KEY DEFAULT true CHECK (id)`: the PK admits exactly one
-- value, so a second row is a constraint violation, not a silent second config.
CREATE TABLE IF NOT EXISTS public.platform_fee_settings (
  id                      boolean PRIMARY KEY DEFAULT true CHECK (id),
  rank_floor_pct          numeric(5,2) NOT NULL DEFAULT 8.00
                          CHECK (rank_floor_pct >= 0 AND rank_floor_pct <= 50),
  founding_discount_pct   numeric(5,2) NOT NULL DEFAULT 50.00
                          CHECK (founding_discount_pct >= 0 AND founding_discount_pct <= 100),
  -- APPROVED: 12 months (design said 6). Counted from founding_since / created_at.
  founding_months         integer NOT NULL DEFAULT 12
                          CHECK (founding_months >= 0 AND founding_months <= 240),
  -- The Terms' 14-day fee-change notice, as data. One number, one place.
  base_change_notice_days integer NOT NULL DEFAULT 14
                          CHECK (base_change_notice_days >= 0),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid REFERENCES public.profiles(id)
);
COMMENT ON TABLE public.platform_fee_settings IS
  'Single-row platform fee configuration: rank floor, founding programme terms (50% for founding_months from founding_since), and the Terms 14-day notice period. Read by resolve_seller_fee and by the notice trigger.';

INSERT INTO public.platform_fee_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_fee_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_fee_settings_read_all ON public.platform_fee_settings;
CREATE POLICY platform_fee_settings_read_all ON public.platform_fee_settings FOR SELECT USING (true);
REVOKE ALL ON TABLE public.platform_fee_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.platform_fee_settings TO anon, authenticated;

-- ── 4. seller_tier_config.discount_pts — additive rank steps ──────────────
-- Additive, not multiplicative: a multiplier cannot express "0.5 points"
-- without depending on the base. fee_multiplier / commission_rate stay until
-- PR 6 (read by get_seller_tier_info → /account/tiers). Default 0 = money
-- neutral; the real 0/0.5/1.0/1.5/2.0 ladder is PR 4 data.
ALTER TABLE public.seller_tier_config
  ADD COLUMN IF NOT EXISTS discount_pts numeric(4,2) NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seller_tier_config_discount_pts_check') THEN
    ALTER TABLE public.seller_tier_config
      ADD CONSTRAINT seller_tier_config_discount_pts_check
      CHECK (discount_pts >= 0 AND discount_pts <= 10);
  END IF;
END $$;
COMMENT ON COLUMN public.seller_tier_config.discount_pts IS
  'Percentage POINTS off the base rate for this rank. Applied by resolve_seller_fee only when base_pct > platform_fee_settings.rank_floor_pct, and never below that floor.';

-- ── 5. profiles.founding_since ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS founding_since timestamptz;
COMMENT ON COLUMN public.profiles.founding_since IS
  'When the founding-seller programme started for this seller. The discount window is [anchor, anchor + platform_fee_settings.founding_months) where anchor = COALESCE(founding_since, created_at). Backfilled to created_at for every existing founding seller (fee engine PR 1). Protected by guard_profiles_protected_columns.';
CREATE INDEX IF NOT EXISTS idx_profiles_founding_since
  ON public.profiles (founding_since) WHERE founding_since IS NOT NULL;

-- ── 6. orders — the commission snapshot ───────────────────────────────────
-- Nullable on purpose: every order that exists today has no snapshot and
-- cannot be given a truthful one. NULL = "pre-engine order, rate not recorded".
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS seller_commission_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS seller_fee_trace      jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_seller_commission_pct_check') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_seller_commission_pct_check
      CHECK (seller_commission_pct IS NULL
             OR (seller_commission_pct >= 0 AND seller_commission_pct <= 50));
  END IF;
END $$;
COMMENT ON COLUMN public.orders.seller_commission_pct IS
  'The seller commission rate charged on THIS order, snapshotted at creation. NULL = order predates the fee engine. Protected by guard_orders_protected_columns.';
COMMENT ON COLUMN public.orders.seller_fee_trace IS
  'The full resolve_seller_fee() row that produced seller_commission_pct: rule_id, rule_kind, rule_scope, base_pct, rank, rank_pts, founding_applied, floor_applied, fallback_count, resolved_at, resolver_version. rule_id NULL = resolved through the fallback (see view fee_resolution_gaps).';
-- No index on seller_fee_trace: read one order at a time by primary key.

-- ── 7. Guard triggers — protect the new money columns ─────────────────────
-- BOTH functions are re-created IN FULL, every existing check verbatim from
-- 20260911120000, with the new columns appended. Triggers unchanged.
--   orders:   an unguarded seller_commission_pct would let a seller rewrite the
--             recorded rate on their own order through PostgREST and dispute
--             the payout against it (AUTH-002 hole class).
--   profiles: without founding_since guarded, a seller could re-arm their own
--             expired 50% discount.
CREATE OR REPLACE FUNCTION public.guard_orders_protected_columns() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changed text[] := '{}';
BEGIN
  IF public.guarded_write_allowed() THEN
    RETURN NEW;
  END IF;
  IF NEW.seller_payout IS DISTINCT FROM OLD.seller_payout THEN changed := array_append(changed, 'seller_payout'); END IF;
  IF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN changed := array_append(changed, 'total_amount'); END IF;
  IF NEW.subtotal IS DISTINCT FROM OLD.subtotal THEN changed := array_append(changed, 'subtotal'); END IF;
  IF NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN changed := array_append(changed, 'unit_price'); END IF;
  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN changed := array_append(changed, 'quantity'); END IF;
  IF NEW.platform_fee IS DISTINCT FROM OLD.platform_fee THEN changed := array_append(changed, 'platform_fee'); END IF;
  IF NEW.platform_fee_rate IS DISTINCT FROM OLD.platform_fee_rate THEN changed := array_append(changed, 'platform_fee_rate'); END IF;
  IF NEW.payment_processing_fee IS DISTINCT FROM OLD.payment_processing_fee THEN changed := array_append(changed, 'payment_processing_fee'); END IF;
  IF NEW.payment_processing_fee_rate IS DISTINCT FROM OLD.payment_processing_fee_rate THEN changed := array_append(changed, 'payment_processing_fee_rate'); END IF;
  IF NEW.vaultshield_tier_fee IS DISTINCT FROM OLD.vaultshield_tier_fee THEN changed := array_append(changed, 'vaultshield_tier_fee'); END IF;
  IF NEW.vaultshield_tier_fee_rate IS DISTINCT FROM OLD.vaultshield_tier_fee_rate THEN changed := array_append(changed, 'vaultshield_tier_fee_rate'); END IF;
  IF NEW.promo_discount IS DISTINCT FROM OLD.promo_discount THEN changed := array_append(changed, 'promo_discount'); END IF;
  IF NEW.promo_code_id IS DISTINCT FROM OLD.promo_code_id THEN changed := array_append(changed, 'promo_code_id'); END IF;
  IF NEW.currency IS DISTINCT FROM OLD.currency THEN changed := array_append(changed, 'currency'); END IF;
  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id THEN changed := array_append(changed, 'buyer_id'); END IF;
  IF NEW.seller_id IS DISTINCT FROM OLD.seller_id THEN changed := array_append(changed, 'seller_id'); END IF;
  IF NEW.listing_id IS DISTINCT FROM OLD.listing_id THEN changed := array_append(changed, 'listing_id'); END IF;
  IF NEW.escrow_status IS DISTINCT FROM OLD.escrow_status THEN changed := array_append(changed, 'escrow_status'); END IF;
  -- ── fee engine (PR 1) ──
  IF NEW.seller_commission_pct IS DISTINCT FROM OLD.seller_commission_pct THEN changed := array_append(changed, 'seller_commission_pct'); END IF;
  IF NEW.seller_fee_trace IS DISTINCT FROM OLD.seller_fee_trace THEN changed := array_append(changed, 'seller_fee_trace'); END IF;
  IF array_length(changed, 1) > 0 THEN
    RAISE EXCEPTION 'orders: column(s) % are protected and cannot be changed by this caller',
      array_to_string(changed, ', ')
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_profiles_protected_columns() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changed text[] := '{}';
BEGIN
  IF public.guarded_write_allowed() THEN
    RETURN NEW;
  END IF;
  IF NEW.seller_status IS DISTINCT FROM OLD.seller_status THEN changed := array_append(changed, 'seller_status'); END IF;
  IF NEW.seller_restriction_reason IS DISTINCT FROM OLD.seller_restriction_reason THEN changed := array_append(changed, 'seller_restriction_reason'); END IF;
  IF NEW.seller_restricted_at IS DISTINCT FROM OLD.seller_restricted_at THEN changed := array_append(changed, 'seller_restricted_at'); END IF;
  IF NEW.seller_restricted_by IS DISTINCT FROM OLD.seller_restricted_by THEN changed := array_append(changed, 'seller_restricted_by'); END IF;
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status THEN changed := array_append(changed, 'kyc_status'); END IF;
  IF NEW.kyc_submitted_at IS DISTINCT FROM OLD.kyc_submitted_at THEN changed := array_append(changed, 'kyc_submitted_at'); END IF;
  IF NEW.badges IS DISTINCT FROM OLD.badges THEN changed := array_append(changed, 'badges'); END IF;
  IF NEW.total_sales IS DISTINCT FROM OLD.total_sales THEN changed := array_append(changed, 'total_sales'); END IF;
  IF NEW.seller_rating IS DISTINCT FROM OLD.seller_rating THEN changed := array_append(changed, 'seller_rating'); END IF;
  IF NEW.total_reviews IS DISTINCT FROM OLD.total_reviews THEN changed := array_append(changed, 'total_reviews'); END IF;
  IF NEW.positive_reviews IS DISTINCT FROM OLD.positive_reviews THEN changed := array_append(changed, 'positive_reviews'); END IF;
  IF NEW.founding_seller IS DISTINCT FROM OLD.founding_seller THEN changed := array_append(changed, 'founding_seller'); END IF;
  IF NEW.is_test IS DISTINCT FROM OLD.is_test THEN changed := array_append(changed, 'is_test'); END IF;
  IF NEW.is_guest IS DISTINCT FROM OLD.is_guest THEN changed := array_append(changed, 'is_guest'); END IF;
  IF NEW.payout_enabled IS DISTINCT FROM OLD.payout_enabled THEN changed := array_append(changed, 'payout_enabled'); END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN changed := array_append(changed, 'email'); END IF;
  IF NEW.paypal_email IS DISTINCT FROM OLD.paypal_email THEN changed := array_append(changed, 'paypal_email'); END IF;
  IF NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id THEN changed := array_append(changed, 'stripe_account_id'); END IF;
  IF NEW.stripe_connect_account_id IS DISTINCT FROM OLD.stripe_connect_account_id THEN changed := array_append(changed, 'stripe_connect_account_id'); END IF;
  IF NEW.stripe_connect_status IS DISTINCT FROM OLD.stripe_connect_status THEN changed := array_append(changed, 'stripe_connect_status'); END IF;
  IF NEW.stripe_connect_charges_enabled IS DISTINCT FROM OLD.stripe_connect_charges_enabled THEN changed := array_append(changed, 'stripe_connect_charges_enabled'); END IF;
  IF NEW.stripe_connect_payouts_enabled IS DISTINCT FROM OLD.stripe_connect_payouts_enabled THEN changed := array_append(changed, 'stripe_connect_payouts_enabled'); END IF;
  IF NEW.stripe_connect_onboarding_url IS DISTINCT FROM OLD.stripe_connect_onboarding_url THEN changed := array_append(changed, 'stripe_connect_onboarding_url'); END IF;
  IF NEW.stripe_connect_connected_at IS DISTINCT FROM OLD.stripe_connect_connected_at THEN changed := array_append(changed, 'stripe_connect_connected_at'); END IF;
  IF NEW.seller_balance IS DISTINCT FROM OLD.seller_balance THEN changed := array_append(changed, 'seller_balance'); END IF;
  IF NEW.pending_balance IS DISTINCT FROM OLD.pending_balance THEN changed := array_append(changed, 'pending_balance'); END IF;
  IF NEW.lifetime_earnings IS DISTINCT FROM OLD.lifetime_earnings THEN changed := array_append(changed, 'lifetime_earnings'); END IF;
  IF NEW.loyalty_balance IS DISTINCT FROM OLD.loyalty_balance THEN changed := array_append(changed, 'loyalty_balance'); END IF;
  IF NEW.lifetime_cashback_earned IS DISTINCT FROM OLD.lifetime_cashback_earned THEN changed := array_append(changed, 'lifetime_cashback_earned'); END IF;
  -- ── fee engine (PR 1) ──
  IF NEW.founding_since IS DISTINCT FROM OLD.founding_since THEN changed := array_append(changed, 'founding_since'); END IF;
  IF array_length(changed, 1) > 0 THEN
    RAISE EXCEPTION 'profiles: column(s) % are protected and cannot be changed by this caller',
      array_to_string(changed, ', ')
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 8. fee_rules write triggers — what a CHECK cannot carry ───────────────
-- (a) The Terms' 14-day notice becomes a DATA rule. Promos exempt (the Terms
--     say so). app.fee_backfill is transaction-local and honoured only for a
--     caller guarded_write_allowed() already trusts (service_role / SQL editor
--     / migration); its ONE legitimate caller is the money-neutral seed, which
--     must write rules with historical starts_at. Same pattern as
--     app.guarded_write (20260911120000). PostgREST callers cannot set it.
CREATE OR REPLACE FUNCTION public.fee_rules_enforce_notice() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_days integer;
BEGIN
  IF NEW.kind = 'promo' THEN
    RETURN NEW;
  END IF;
  IF public.guarded_write_allowed()
     AND COALESCE(current_setting('app.fee_backfill', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  SELECT base_change_notice_days INTO v_days FROM public.platform_fee_settings WHERE id;
  v_days := COALESCE(v_days, 14);
  IF NEW.starts_at < now() + make_interval(days => v_days) THEN
    RAISE EXCEPTION 'fee_rules: a base rate change needs % days notice (earliest permitted start: %)',
      v_days, (now() + make_interval(days => v_days))
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- (b) category_type on a pair rule must equal the pair's own type. OVERWRITES
--     rather than validates, so the denormalised column cannot be wrong.
CREATE OR REPLACE FUNCTION public.fee_rules_sync_category_type() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.game_category_id IS NOT NULL THEN
    SELECT gc.type INTO NEW.category_type
    FROM public.game_categories gc WHERE gc.id = NEW.game_category_id;
    IF NEW.category_type IS NULL THEN
      RAISE EXCEPTION 'fee_rules: game_category % has no type', NEW.game_category_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- sync runs FIRST (name order 'a_' < 'b_') so the notice check and the
-- exclusion constraint both see the corrected category_type.
DROP TRIGGER IF EXISTS trg_a_fee_rules_sync_category_type ON public.fee_rules;
CREATE TRIGGER trg_a_fee_rules_sync_category_type
  BEFORE INSERT OR UPDATE ON public.fee_rules
  FOR EACH ROW EXECUTE FUNCTION public.fee_rules_sync_category_type();
DROP TRIGGER IF EXISTS trg_b_fee_rules_enforce_notice ON public.fee_rules;
CREATE TRIGGER trg_b_fee_rules_enforce_notice
  BEFORE INSERT OR UPDATE ON public.fee_rules
  FOR EACH ROW EXECUTE FUNCTION public.fee_rules_enforce_notice();

-- Trigger functions need no grants-guard entry (db_p0_posture filters
-- prorettype = trigger) but must still be revoked.
REVOKE ALL ON FUNCTION public.fee_rules_enforce_notice() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fee_rules_sync_category_type() FROM PUBLIC, anon, authenticated;

-- ── 9. THE RESOLVER ───────────────────────────────────────────────────────
-- ONE function. Every surface (checkout, sell wizard, /[game]/sell, the public
-- fee page, admin preview) calls this and NOTHING re-implements it in TS.
--   STABLE           — reads tables, never writes.
--   SECURITY DEFINER — the public page resolves with no session; checkout
--                      resolves under the BUYER's JWT for a rate that depends
--                      on the SELLER's profile row (not readable under RLS).
--   search_path      — mandatory (CLAUDE.md).
-- PRECEDENCE (fee-engine.md §2.2):
--   2a promo@pair → 2b promo@category → 2c base@pair → 2d base@category → 2e fallback
--   then: founding (wins outright, ignores rank) ELSE rank (floored) ELSE base
CREATE OR REPLACE FUNCTION public.resolve_seller_fee(
  p_seller_id        uuid,
  p_game_category_id uuid,
  p_at               timestamptz DEFAULT now()
) RETURNS TABLE (
  pct              numeric,
  base_pct         numeric,
  rule_id          uuid,
  rule_kind        text,
  rule_scope       text,
  rank             text,
  rank_pts         numeric,
  founding_applied boolean,
  floor_applied    boolean,
  fallback_count   integer,
  resolver_version integer,
  resolved_at      timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type            text;
  v_rule            record;
  v_base            numeric;
  v_pct             numeric;
  v_rule_id         uuid    := NULL;
  v_rule_kind       text    := NULL;
  v_rule_scope      text    := NULL;
  v_rank            text    := NULL;
  v_rank_pts        numeric := 0;
  v_founding        boolean := false;
  v_floor_applied   boolean := false;
  v_fallback        integer := 0;
  v_seller          record;
  v_settings        record;
  v_floor           numeric;
  v_anchor          timestamptz;
  v_at              timestamptz := COALESCE(p_at, now());
BEGIN
  -- ── 0. Input. A missing pair is an invalid call, not a free listing. ────
  IF p_game_category_id IS NULL THEN
    RAISE EXCEPTION 'resolve_seller_fee: p_game_category_id is required'
      USING ERRCODE = 'null_value_not_allowed';
  END IF;

  SELECT gc.type INTO v_type
  FROM public.game_categories gc WHERE gc.id = p_game_category_id;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'resolve_seller_fee: no game_category %', p_game_category_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT * INTO v_settings FROM public.platform_fee_settings WHERE id;
  v_floor := COALESCE(v_settings.rank_floor_pct, 8.00);

  -- ── 2. BASE RATE — first match wins, by precedence tier. ORDER BY tier,
  --      starts_at DESC, created_at DESC, id makes the choice TOTAL and
  --      deterministic (pinned by a test).
  SELECT fr.id, fr.pct, fr.kind, fr.scope
    INTO v_rule
  FROM public.fee_rules fr
  WHERE fr.validity @> v_at
    AND (
      (fr.scope = 'game_category' AND fr.game_category_id = p_game_category_id)
      OR
      (fr.scope = 'category' AND fr.game_category_id IS NULL AND fr.category_type = v_type)
    )
  ORDER BY
    CASE
      WHEN fr.kind = 'promo' AND fr.scope = 'game_category' THEN 1   -- 2a
      WHEN fr.kind = 'promo' AND fr.scope = 'category'      THEN 2   -- 2b
      WHEN fr.kind = 'base'  AND fr.scope = 'game_category' THEN 3   -- 2c
      ELSE 4                                                          -- 2d
    END,
    fr.starts_at DESC,
    fr.created_at DESC,
    fr.id
  LIMIT 1;

  IF v_rule.id IS NOT NULL THEN
    v_base       := v_rule.pct;
    v_rule_id    := v_rule.id;
    v_rule_kind  := v_rule.kind;
    v_rule_scope := v_rule.scope;
  ELSE
    -- 2e FALLBACK. Conservative platform defaults, seeded identically into
    -- fee_rules by the seed migration so this is never reached in a correctly
    -- seeded DB. rule_id NULL + fallback_count 1 make a fallback-resolved
    -- order VISIBLE (view fee_resolution_gaps) rather than hiding a config gap
    -- behind a plausible number. Raising was rejected: it would take the
    -- marketplace down on a missing config row.
    v_fallback := 1;
    v_base := CASE v_type
                WHEN 'currency'  THEN 10.00
                WHEN 'items'     THEN 10.00
                WHEN 'account'   THEN 15.00
                WHEN 'top_up'    THEN  5.00
                WHEN 'service'   THEN 10.00
                WHEN 'gift_card' THEN  5.00
                ELSE 10.00
              END;
  END IF;

  v_pct := v_base;

  -- ── 3. SELLER ADJUSTMENT. p_seller_id IS NULL is a FIRST-CLASS input: the
  --      rate before any seller adjustment (public fee page, logged-out sell
  --      wizard). Step 3 is skipped whole.
  IF p_seller_id IS NOT NULL THEN
    SELECT p.seller_tier, p.founding_seller, p.founding_since, p.created_at
      INTO v_seller
    FROM public.profiles p WHERE p.id = p_seller_id;

    v_rank := v_seller.seller_tier;

    -- 3a. FOUNDING — wins outright and IGNORES RANK. The rank floor does NOT
    --     apply here: it bounds how far the RANK LADDER may discount, it is
    --     not a platform-wide minimum (a 0% promo already proves sub-floor
    --     rates are accepted). Anchor = founding_since, else created_at, so a
    --     founding grant that forgot founding_since still gets the programme.
    IF COALESCE(v_seller.founding_seller, false) THEN
      v_anchor := COALESCE(v_seller.founding_since, v_seller.created_at);
      IF v_anchor IS NOT NULL
         AND v_at >= v_anchor
         AND v_at <  v_anchor + make_interval(months => COALESCE(v_settings.founding_months, 12)) THEN
        v_pct      := v_base * (1 - COALESCE(v_settings.founding_discount_pct, 50.00) / 100);
        v_founding := true;
      END IF;
    END IF;

    -- 3b. RANK — only when founding did NOT apply, only when the base is
    --     ABOVE the floor. A 5% or 0% base is never touched, and the floor
    --     NEVER RAISES a rate. Tier looked up by name; unknown/NULL tier = 0.
    IF NOT v_founding THEN
      SELECT COALESCE(stc.discount_pts, 0) INTO v_rank_pts
      FROM public.seller_tier_config stc
      WHERE stc.tier = v_seller.seller_tier;
      v_rank_pts := COALESCE(v_rank_pts, 0);

      IF v_rank_pts > 0 AND v_base > v_floor THEN
        v_pct := GREATEST(v_floor, v_base - v_rank_pts);
        v_floor_applied := (v_base - v_rank_pts) < v_floor;
      ELSE
        -- Not applied: report 0 points so the trace never claims a discount
        -- that did not happen.
        v_rank_pts := 0;
      END IF;
    ELSE
      v_rank_pts := 0;
    END IF;
  END IF;

  -- ── 4. R-1 (round half-up, once, at the end) + R-3 (clamp [0,50]). ──────
  v_pct := round(LEAST(GREATEST(v_pct, 0), 50), 2);

  RETURN QUERY SELECT
    v_pct, round(v_base, 2), v_rule_id, v_rule_kind, v_rule_scope,
    v_rank, v_rank_pts, v_founding, v_floor_applied, v_fallback, 1, v_at;
END;
$$;

COMMENT ON FUNCTION public.resolve_seller_fee(uuid, uuid, timestamptz) IS
  'THE seller-commission resolver. Every surface reads this; nothing re-implements it in TypeScript. p_seller_id NULL = the pre-adjustment rate for public pages. Returns the rate AND the trace that explains it (stamped onto orders.seller_fee_trace). fallback_count = 1 when no fee_rules row matched.';

-- MANDATORY GRANT: new functions are service-role-only by default
-- (20260913100000). anon is required — the public fee page and the ISR'd
-- /[game]/sell render with no session. Exposure review: with a non-NULL
-- p_seller_id this returns a PERCENTAGE the seller already publishes (rank
-- badge, founding badge) — no balance, no email, no application data.
-- Companion: 'resolve_seller_fee' in ANON_DEFINER_ALLOWLIST
-- (src/test/guards/db-p0-grants.guard.integration.test.ts).
REVOKE ALL ON FUNCTION public.resolve_seller_fee(uuid, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_seller_fee(uuid, uuid, timestamptz)
  TO anon, authenticated, service_role;

-- ── 10. fee_resolution_gaps — the fallback, made alertable ────────────────
-- Engine-era orders (trace present) whose base rate came from the hard-coded
-- fallback rather than a fee_rules row. Must stay empty; see docs/checkout.md
-- "Ops: fee resolution gaps". security_invoker: carries the CALLER's rights
-- over orders (CLAUDE.md); service-role / SQL-editor is the intended reader.
CREATE OR REPLACE VIEW public.fee_resolution_gaps
WITH (security_invoker = true) AS
  SELECT o.id, o.created_at, o.seller_id, o.listing_id,
         o.seller_commission_pct, o.seller_fee_trace
  FROM public.orders o
  WHERE o.seller_fee_trace IS NOT NULL
    AND (o.seller_fee_trace->>'rule_id') IS NULL;
COMMENT ON VIEW public.fee_resolution_gaps IS
  'Orders priced through resolve_seller_fee()''s hard-coded fallback (seller_fee_trace.rule_id IS NULL). A non-empty result is a fee_rules config gap — alert on count(*) > 0.';
REVOKE ALL ON TABLE public.fee_resolution_gaps FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.fee_resolution_gaps TO service_role;

-- ── 11. Audit — reuse fee_config_audit, add the index it never had ────────
-- New scope values: 'fee_rule' | 'platform_setting' | 'rank_step' | 'founding_since'.
-- Rows are written by the admin ACTION (PR 5), not a trigger: a trigger cannot
-- see WHICH admin acted through a service-role client.
CREATE INDEX IF NOT EXISTS idx_fee_config_audit_scope_created
  ON public.fee_config_audit (scope, created_at DESC);

-- ── 12. Proof — refuse to finish half-applied ─────────────────────────────
DO $$
BEGIN
  IF NOT has_function_privilege('anon', 'public.resolve_seller_fee(uuid, uuid, timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'fee engine: resolve_seller_fee is not executable by anon';
  END IF;
  IF has_function_privilege('anon', 'public.fee_rules_enforce_notice()', 'EXECUTE') THEN
    RAISE EXCEPTION 'fee engine: fee_rules_enforce_notice must not be executable by anon';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_rules_no_overlapping_base') THEN
    RAISE EXCEPTION 'fee engine: exclusion constraint missing';
  END IF;
  IF NOT COALESCE((SELECT o.option_value IN ('on','true')
                   FROM pg_class c, pg_options_to_table(c.reloptions) o
                   WHERE c.oid = 'public.fee_resolution_gaps'::regclass AND o.option_name = 'security_invoker'), false) THEN
    RAISE EXCEPTION 'fee engine: fee_resolution_gaps is not security_invoker';
  END IF;
END $$;

-- ── ROLLBACK (nothing reads any of this yet) ──────────────────────────────
--   DROP VIEW     IF EXISTS public.fee_resolution_gaps;
--   DROP FUNCTION IF EXISTS public.resolve_seller_fee(uuid, uuid, timestamptz);
--   DROP TRIGGER  IF EXISTS trg_b_fee_rules_enforce_notice    ON public.fee_rules;
--   DROP TRIGGER  IF EXISTS trg_a_fee_rules_sync_category_type ON public.fee_rules;
--   DROP FUNCTION IF EXISTS public.fee_rules_enforce_notice();
--   DROP FUNCTION IF EXISTS public.fee_rules_sync_category_type();
--   DROP FUNCTION IF EXISTS public.fee_engine_version();
--   DROP TABLE    IF EXISTS public.fee_rules;
--   DROP TABLE    IF EXISTS public.platform_fee_settings;
--   DROP INDEX    IF EXISTS public.idx_profiles_founding_since;
--   DROP INDEX    IF EXISTS public.idx_fee_config_audit_scope_created;
--   ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_seller_commission_pct_check,
--     DROP COLUMN IF EXISTS seller_commission_pct, DROP COLUMN IF EXISTS seller_fee_trace;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS founding_since;
--   ALTER TABLE public.seller_tier_config DROP CONSTRAINT IF EXISTS seller_tier_config_discount_pts_check,
--     DROP COLUMN IF EXISTS discount_pts;
--   -- AND re-create guard_orders_protected_columns + guard_profiles_protected_columns
--   -- from their 20260911120000 bodies (they reference the dropped columns).
