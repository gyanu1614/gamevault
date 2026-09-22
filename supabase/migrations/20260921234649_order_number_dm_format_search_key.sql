-- ═══════════════════════════════════════════════════════════════════════════
-- Order numbers: DM-XXXX-XXXX format + normalised search key
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY. 20260921230440 made generate_order_number() crypto-random and
-- collision-checked but kept the legacy 'GV-' prefix, which three display
-- sites then rewrote to 'DM-' at render time. The stored number is now the
-- brand's number: 'DM-' + 4 + '-' + 4 symbols, and the display swaps go.
-- Numbers already issued (GV-123456, GV-XXXXXXXXXX) stay exactly as stored;
-- nothing here rewrites a row, and every reader treats the column as an
-- opaque label.
--
-- WHAT.
--   1. generate_order_number(): same crypto source (extensions.gen_random_bytes),
--      same unambiguous 32-symbol alphabet (no 0/O/1/I; 32 = 5 bits so
--      byte % 32 is unbiased), same existence loop and RAISE after 5 misses,
--      same SECURITY DEFINER + pinned search_path, same service-role-only
--      grants. Only the shape changes: 'DM-' + 8 symbols grouped 4-4
--      (space 32^8 ≈ 1.1e12; still not a sequence, so order volume stays
--      private).
--   2. orders.order_number_search: a STORED generated column holding the
--      number upper-cased with every non-alphanumeric stripped
--      ('DM-abcd-efgh' → 'DMABCDEFGH', 'GV-123456' → 'GV123456'). Lookups
--      (admin search, seller order search, support) normalise the typed
--      query the same way (src/lib/orders/order-number.ts) and match this
--      column, so "dm abcd efgh", "DMABCDEFGH" and "DM-ABCD-EFGH" all find
--      the same order — and a GV- order is found the same way. Inline
--      expression, no function: a generated column is recomputed on UPDATE
--      as the updating role, and a function would need EXECUTE for every
--      role that may touch orders.
--   3. orders_order_number_search_idx: btree with text_pattern_ops on the
--      search key. The previous ilike on order_number had no usable index
--      at all; this one serves exact and prefix lookups. Contains-matches
--      still scan (no pg_trgm on this database).
--
-- ROLLBACK (only the shape; the search column is harmless to keep):
--   re-run the CREATE OR REPLACE FUNCTION from 20260921230440.
--   DROP INDEX IF EXISTS public.orders_order_number_search_idx;
--   ALTER TABLE public.orders DROP COLUMN IF EXISTS order_number_search;

CREATE OR REPLACE FUNCTION public.generate_order_number() RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- 32 symbols, no 0/O/1/I. Length 32 makes (byte % 32) uniform.
  alphabet   CONSTANT text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  max_tries  CONSTANT int  := 5;
  raw        bytea;
  candidate  text;
  i          int;
BEGIN
  FOR attempt IN 1..max_tries LOOP
    raw := extensions.gen_random_bytes(8);
    candidate := 'DM-';
    FOR i IN 0..7 LOOP
      candidate := candidate || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
      IF i = 3 THEN
        candidate := candidate || '-';
      END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.order_number = candidate) THEN
      RETURN candidate;
    END IF;
  END LOOP;
  -- 5 misses in a 1.1e12 space means something is wrong (a filled table, a
  -- broken RNG); refuse rather than hand back a number that may collide.
  RAISE EXCEPTION 'generate_order_number: no unused order number after % attempts', max_tries
    USING ERRCODE = 'internal_error';
END;
$$;

COMMENT ON FUNCTION public.generate_order_number() IS
  'Order reference for orders.order_number: ''DM-'' + 8 crypto-random symbols grouped 4-4 from an unambiguous 32-symbol alphabet (no 0/O/1/I), checked against existing orders, RAISEs after 5 misses. Called only by trigger set_order_number_if_null. SECURITY DEFINER so the existence check sees every row; service_role-only. Older GV- numbers stay valid.';

REVOKE ALL ON FUNCTION public.generate_order_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_order_number() FROM anon;
REVOKE ALL ON FUNCTION public.generate_order_number() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;

-- ── Normalised search key ──────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number_search text
    GENERATED ALWAYS AS (upper(regexp_replace(order_number, '[^A-Za-z0-9]', '', 'g'))) STORED;

COMMENT ON COLUMN public.orders.order_number_search IS
  'order_number upper-cased with every non-alphanumeric stripped (generated). Lookups normalise the typed query the same way (src/lib/orders/order-number.ts) and match here, so dashes, spaces and case never hide an order.';

CREATE INDEX IF NOT EXISTS orders_order_number_search_idx
  ON public.orders (order_number_search text_pattern_ops);

-- PostgREST caches the column list; make the new column filterable at once.
NOTIFY pgrst, 'reload schema';

-- ── Self-check ─────────────────────────────────────────────────────────────
DO $$
DECLARE n text; k int; gen text; idx int;
BEGIN
  n := public.generate_order_number();
  IF n !~ '^DM-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$' THEN
    RAISE EXCEPTION 'generate_order_number self-check: bad format %', n;
  END IF;
  SELECT count(*) - count(DISTINCT x) INTO k
  FROM (SELECT public.generate_order_number() AS x FROM generate_series(1, 1000)) s;
  IF k <> 0 THEN
    RAISE EXCEPTION 'generate_order_number self-check: % duplicate(s) in 1000 draws', k;
  END IF;
  IF has_function_privilege('anon', 'public.generate_order_number()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.generate_order_number()', 'EXECUTE') THEN
    RAISE EXCEPTION 'generate_order_number self-check: still executable by anon/authenticated';
  END IF;

  SELECT is_generated INTO gen FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'order_number_search';
  IF gen IS DISTINCT FROM 'ALWAYS' THEN
    RAISE EXCEPTION 'order_number_search self-check: column missing or not generated (%)', gen;
  END IF;
  -- The generated expression normalises exactly as the TS helper does.
  IF upper(regexp_replace('dm-abcd-efgh', '[^A-Za-z0-9]', '', 'g')) <> 'DMABCDEFGH'
     OR upper(regexp_replace(' gv-123 456 ', '[^A-Za-z0-9]', '', 'g')) <> 'GV123456' THEN
    RAISE EXCEPTION 'order_number_search self-check: normalisation expression drifted';
  END IF;
  SELECT count(*) INTO idx FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'orders' AND indexname = 'orders_order_number_search_idx';
  IF idx <> 1 THEN
    RAISE EXCEPTION 'order_number_search self-check: index missing';
  END IF;
END $$;
