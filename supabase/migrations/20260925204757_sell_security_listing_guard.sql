-- ============================================================================
-- /sell security hardening (audit docs/audit/sell-full-audit.md §4, 2026-09-25)
--
-- One BEFORE INSERT OR UPDATE trigger, `validate_listing_write`, is the
-- database's word on what a listings row may look like. It runs LAST among
-- the BEFORE triggers on listings (the name sorts after
-- trg_listings_category_sync, which derives game_category_id, and after
-- trg_guard_listings_protected_columns, which coerces untrusted inserts), so
-- every rule below sees the final row.
--
-- Trust model (unchanged from 20260911120000): `guarded_write_allowed()` is
-- true for the service role, for migrations, and for SQL functions that set
-- app.guarded_write. Rules marked "untrusted only" protect against a JWT
-- caller on PostgREST; rules marked "every caller" are data invariants the
-- app's own service-role writes must satisfy too.
--
-- ACC-03 — seller edits bypassed publish-time validation.
--   · UPDATE on listings is REVOKED from anon/authenticated and the two seller
--     UPDATE policies are dropped: every seller edit now goes through a
--     validated server action (src/lib/listings/validate.ts) that writes with
--     the service role after an ownership check. Admin session code paths
--     that wrote listings directly were moved to the service role in the same
--     change. SECURITY DEFINER RPCs (approve_listing, order_confirm_payment,
--     update_listing_quantity, …) run as their owner and are unaffected.
--   · untrusted callers cannot move a listing to another game / category.
--   · every caller: the (game, category) pair must be enabled on INSERT and
--     whenever it changes; delivery_method must be manual|instant.
--   · AUTH-034 (moderated-out → active only through review) now also binds
--     the service role: the app's actions are the seller's only edit path.
-- ACC-06 — $0 listings: CHECK (price > 0) replaces the baseline's >= 0; the
--   validator adds the $0.01 floor, numeric(12,4) rounding and the per-game
--   currency floor / ceiling.
-- ACC-05 — minimum order size: min_quantity <= quantity unless unlimited (the
--   config floor, the bundle-id check and the cap live in the validator;
--   createCheckout now refuses quantity < min_quantity).
-- ============================================================================

-- ── ACC-03: no direct UPDATE for JWT callers ────────────────────────────────
REVOKE UPDATE ON TABLE public.listings FROM anon, authenticated;
DROP POLICY IF EXISTS "Sellers can update own listings" ON public.listings;
DROP POLICY IF EXISTS "Sellers can update their own listings" ON public.listings;

-- ── ACC-06: price > 0 ───────────────────────────────────────────────────────
-- The baseline allowed price >= 0; a $0 listing produced a $0 order that took
-- checkout's wallet-covered auto-confirm path (free orders between two
-- accounts to farm reviews / rank). Added NOT VALID so a production row at 0
-- cannot fail the push; validated in place when no such row exists (the
-- handoff carries the query to run before validating manually otherwise).
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_price_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_price_check CHECK (price > 0) NOT VALID;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.listings WHERE price <= 0) THEN
    ALTER TABLE public.listings VALIDATE CONSTRAINT listings_price_check;
  ELSE
    RAISE NOTICE 'listings_price_check left NOT VALID: % row(s) have price <= 0',
      (SELECT count(*) FROM public.listings WHERE price <= 0);
  END IF;
END $$;

-- ── validate_listing_write ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_listing_write() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trusted      boolean := public.guarded_write_allowed();
  -- A SQL function that set app.guarded_write (approve_listing, the order
  -- RPCs…). The app's own service-role writes do NOT set it, so a rule that
  -- must survive an application bug is skipped only for v_flagged.
  v_flagged      boolean := COALESCE(current_setting('app.guarded_write', true), '') = 'on';
  v_pair_changed boolean;
BEGIN
  -- AUTH-034, kept for the service role: with UPDATE revoked from JWT callers
  -- the app's actions are the only seller edit path, and they write as the
  -- service role — so the "review is the only way back to active" rule now
  -- has to hold for them too. Only the moderation RPCs (flag) may do it.
  IF TG_OP = 'UPDATE' AND NOT v_flagged
     AND OLD.status IN ('rejected', 'changes_requested', 'pending_approval')
     AND NEW.status = 'active' THEN
    RAISE EXCEPTION 'listings: status % → active is protected; a moderated listing is re-activated only through review',
      OLD.status
      USING ERRCODE = '42501';
  END IF;

  -- ACC-03 (untrusted only): a listing cannot be moved between games or
  -- categories by a JWT caller — that bypassed the AUTH-010 enabled-pair gate.
  IF TG_OP = 'UPDATE' AND NOT v_trusted THEN
    IF NEW.game_id IS DISTINCT FROM OLD.game_id
       OR NEW.game_category_id IS DISTINCT FROM OLD.game_category_id
       OR NEW.category_id IS DISTINCT FROM OLD.category_id THEN
      RAISE EXCEPTION 'listings: game_id / game_category_id are protected and cannot be changed by this caller'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ACC-03 (every caller): the pair must exist, belong to the listing's game,
  -- and be enabled — on INSERT and whenever the pair changes. A pair an admin
  -- disables later keeps its existing rows (stock/status writes still work).
  v_pair_changed := TG_OP = 'INSERT'
    OR NEW.game_id IS DISTINCT FROM OLD.game_id
    OR NEW.game_category_id IS DISTINCT FROM OLD.game_category_id;
  IF v_pair_changed THEN
    IF NEW.game_category_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.game_categories gc
      JOIN public.global_categories g ON g.id = gc.global_category_id
      WHERE gc.id = NEW.game_category_id
        AND gc.game_id = NEW.game_id
        AND gc.is_enabled
        AND g.is_active
    ) THEN
      RAISE EXCEPTION 'listings: this category is not enabled for this game'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- ACC-05 (every caller): a listing nobody can buy — minimum order above
  -- the stock — is refused on INSERT and whenever the minimum is set, and for
  -- JWT callers whenever the stock is set. A sold-out row (quantity 0) and
  -- unlimited stock are exempt; a trusted stock decrement below the minimum
  -- (an order completing) is a legitimate state and is left alone.
  IF (TG_OP = 'INSERT'
      OR NEW.min_quantity IS DISTINCT FROM OLD.min_quantity
      OR (NOT v_trusted AND NEW.quantity IS DISTINCT FROM OLD.quantity))
     AND NOT COALESCE(NEW.is_unlimited, false)
     AND COALESCE(NEW.quantity, 0) > 0
     AND COALESCE(NEW.min_quantity, 1) > NEW.quantity THEN
    RAISE EXCEPTION 'listings: minimum order (%) cannot exceed the stock (%)', NEW.min_quantity, NEW.quantity
      USING ERRCODE = '23514';
  END IF;

  -- ACC-03 (every caller): delivery_method is a closed set.
  IF (TG_OP = 'INSERT' OR NEW.delivery_method IS DISTINCT FROM OLD.delivery_method)
     AND NEW.delivery_method NOT IN ('manual', 'instant') THEN
    RAISE EXCEPTION 'listings: delivery_method must be manual or instant'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_listing_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_z_validate_listing_write ON public.listings;
CREATE TRIGGER trg_z_validate_listing_write
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.validate_listing_write();

-- Probe for integration tests: present ⇒ this migration is applied.
CREATE OR REPLACE FUNCTION public.sell_security_version() RETURNS integer
  LANGUAGE sql IMMUTABLE AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.sell_security_version() FROM PUBLIC, anon, authenticated;
