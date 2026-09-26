-- ═══════════════════════════════════════════════════════════════════════════
-- Order numbers: crypto-random, collision-checked (fee engine PR 3 addendum)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY. The baseline generate_order_number() (20260101000000:844) returned
--   'GV-' || LPAD(floor(random() * 1000000)::text, 6, '0')
-- — six random digits under UNIQUE orders_order_number_key with no existence
-- check and no retry. That is a birthday problem: a batch of 405 numbers
-- collides with itself in ~8% of batches (measured 10/200 on 2026-09-22), and
-- against N existing orders every INSERT fails with probability ≈ N / 1e6.
-- The failure surfaced as SQLSTATE 23505 → PostgREST 409 → createCheckout
-- reading it as the buyer+listing double-submit → "Could not open checkout —
-- please try again" with no order row. Root-caused by the PR 3 parity loop
-- (docs/handoff/fee-pr3.md, addendum).
--
-- WHAT. Same name, same signature, same default (text, no args), so the
-- trigger set_order_number_if_null and every existing order number are
-- untouched. New numbers are 'GV-' + 10 characters drawn with
-- extensions.gen_random_bytes() from a 32-symbol alphabet with no 0/O/1/I
-- (32 symbols = exactly 5 bits: byte % 32 is unbiased). Space 32^10 ≈ 1.1e15.
-- Each candidate is checked against orders before it is returned; after 5
-- misses the function RAISEs instead of returning a number it cannot
-- guarantee. NOT a sequence, on purpose: a sequence exposes order volume.
--
-- SECURITY. The existence check must see EVERY order regardless of who is
-- inserting, so the function is SECURITY DEFINER with search_path pinned
-- (CLAUDE.md). A definer that anon could call is the audit hole class
-- (2026-09-11), so EXECUTE is revoked from PUBLIC/anon/authenticated and
-- granted to service_role only — the only role that inserts orders (client
-- inserts are RLS-blocked). The trigger runs as the inserting role, so
-- service_role and the table owner keep working. No grants-guard allow-list
-- entry is needed: the posture probe lists definers executable by
-- anon/authenticated, and this one is executable by neither.
--
-- ROLLBACK (returns to the colliding generator — only if this proves worse):
--   CREATE OR REPLACE FUNCTION public.generate_order_number() RETURNS text
--   LANGUAGE plpgsql AS $$ BEGIN
--     RETURN 'GV-' || LPAD(floor(random() * 1000000)::text, 6, '0'); END $$;
--   ALTER FUNCTION public.generate_order_number() SECURITY INVOKER;
-- Numbers already issued in either format stay valid: the column is text with
-- no CHECK, and every reader treats it as an opaque label.

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
    raw := extensions.gen_random_bytes(10);
    candidate := 'GV-';
    FOR i IN 0..9 LOOP
      candidate := candidate || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.order_number = candidate) THEN
      RETURN candidate;
    END IF;
  END LOOP;
  -- 5 misses in a 1.1e15 space means something is wrong (a filled table, a
  -- broken RNG); refuse rather than hand back a number that may collide.
  RAISE EXCEPTION 'generate_order_number: no unused order number after % attempts', max_tries
    USING ERRCODE = 'internal_error';
END;
$$;

COMMENT ON FUNCTION public.generate_order_number() IS
  'Order reference for orders.order_number: ''GV-'' + 10 crypto-random symbols from an unambiguous 32-symbol alphabet (no 0/O/1/I), checked against existing orders, RAISEs after 5 misses. Called only by trigger set_order_number_if_null. SECURITY DEFINER so the existence check sees every row; service_role-only.';

REVOKE ALL ON FUNCTION public.generate_order_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_order_number() FROM anon;
REVOKE ALL ON FUNCTION public.generate_order_number() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;

-- ── Self-check ─────────────────────────────────────────────────────────────
DO $$
DECLARE n text; k int;
BEGIN
  n := public.generate_order_number();
  IF n !~ '^GV-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$' THEN
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
END $$;
