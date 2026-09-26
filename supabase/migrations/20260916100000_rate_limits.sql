-- Rate limiting — fixed-window counters in Postgres (no new paid service).
--
-- Why the DB and not an in-process map: Vercel runs many lambda instances
-- across regions, each with its own memory, so an in-memory limiter lets an
-- attacker multiply their budget by the number of warm instances. Postgres is
-- the one thing every instance already shares.
--
-- Model: one row per (key, window_start). `rate_limit_hit` is ONE atomic
-- statement — INSERT .. ON CONFLICT DO UPDATE — so two concurrent callers
-- serialize on the row lock instead of racing a read-then-write. It returns
-- TRUE when the caller is OVER budget (i.e. the request should be rejected).
--
-- Service-role only, per the 20260913100000 posture: the browser must never be
-- able to call this directly (it could burn another IP's budget, or read the
-- counters to learn which keys are close to the limit).

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key           text        NOT NULL,
  window_start  timestamptz NOT NULL,
  count         integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

COMMENT ON TABLE public.rate_limits IS
  'Fixed-window rate limit counters. One row per (key, window_start); written only by rate_limit_hit(). Stale rows are swept nightly by rate_limits_cleanup().';

-- Sweep index: the nightly cleanup deletes by window_start across all keys.
CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx
  ON public.rate_limits (window_start);

-- The table holds no user data, but RLS on + zero policies means that even if a
-- grant is ever added by mistake, PostgREST still returns nothing to anon.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.rate_limits TO service_role;

-- Marker so the guard test can tell "migration not applied" from "regressed".
CREATE OR REPLACE FUNCTION public.rate_limits_version() RETURNS integer
  LANGUAGE sql IMMUTABLE SET search_path = public AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.rate_limits_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limits_version() TO service_role;

-- ---------------------------------------------------------------------------
-- rate_limit_hit(key, limit, window_seconds) -> boolean
--
-- Records one hit against `p_key` and returns TRUE if the caller is now OVER
-- `p_limit` within the current window (so the route should answer 429).
--
-- The window is a fixed bucket derived from the epoch, so every instance that
-- handles a request in the same wall-clock slice computes the same
-- window_start without coordinating.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF p_key IS NULL OR p_key = '' THEN
    RAISE EXCEPTION 'rate_limit_hit: key must be non-empty';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION 'rate_limit_hit: limit must be >= 1 (got %)', p_limit;
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'rate_limit_hit: window_seconds must be >= 1 (got %)', p_window_seconds;
  END IF;

  -- Floor now() to the start of its fixed window bucket.
  v_window_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  -- Atomic increment. Two concurrent callers with the same (key, window) hit
  -- the primary key; the loser blocks on the row lock and then applies its +1
  -- to the winner's value, so no hit is ever lost.
  INSERT INTO public.rate_limits AS rl (key, window_start, count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = rl.count + 1
  RETURNING rl.count INTO v_count;

  RETURN v_count > p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- rate_limits_cleanup(retain_seconds) -> integer
--
-- Deletes counter rows whose window closed longer than `p_retain_seconds` ago.
-- Called nightly from the existing daily cron. Rows are only useful for the
-- length of their own window; the retention default keeps a day of slack so a
-- long window in flight is never truncated mid-flight.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rate_limits_cleanup(p_retain_seconds integer DEFAULT 86400)
  RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_retain_seconds IS NULL OR p_retain_seconds < 0 THEN
    RAISE EXCEPTION 'rate_limits_cleanup: retain_seconds must be >= 0 (got %)', p_retain_seconds;
  END IF;

  DELETE FROM public.rate_limits
  WHERE window_start < now() - make_interval(secs => p_retain_seconds);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limits_cleanup(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limits_cleanup(integer) TO service_role;
