-- Names that read as staff or as DropMarket are refused on every path (plan 2, phase 1).
--
-- The audit on 2026-11-04 found the block only on /founding, as an exact match, so
-- DropMarketSupport, admin1 and Official_Store passed. Settings wrote names straight from the
-- browser with a length check, usernames had no block, and they show to buyers when a seller has
-- no store name. The browser checks can be skipped, so the rule lives here on the row.
--
--   · name_is_reserved: the rule. src/lib/seller/name-rules.ts is the same rule for friendly
--     errors; profile-name-rules.guard.integration.test.ts compares them.
--   · A new account with a reserved or non-English username gets user_<id> instead of a failed
--     signup. handle_new_user takes the username from the email or from signup data the visitor
--     controls, and an error there would stop the whole signup.
--   · Changing a username, store name, shop address or business name to a reserved one is refused
--     for everyone, staff tools included. A name that does not change is never checked, so
--     existing stores keep working until they rename.
--   · For a signed-in user, format and the rename limit also apply. A rename is free until the
--     first completed sale, then once per 90 days. The trigger owns shop_name_updated_at, or the
--     limit could be reset by writing the date.
--   · Store names are unique ignoring case. Production had no duplicates on 2026-11-04.

CREATE OR REPLACE FUNCTION public.name_is_reserved(p_name text) RETURNS boolean
  LANGUAGE sql IMMUTABLE
  SET search_path = public
AS $$
  WITH base AS (
    SELECT regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9@$]', '', 'g') AS n
  ), variants AS (
    SELECT translate(n, '013457@$', 'oieastas') AS v FROM base
    UNION ALL
    SELECT regexp_replace(n, '[^a-z]', '', 'g') FROM base
  )
  SELECT EXISTS (
    SELECT 1 FROM variants
    WHERE v ~ '(dropmarket|safedrop|gamevault|moderat|administrator)'
       OR v ~ '^(admin|staff|support|official|verified)'
       OR v ~ '(admin|staff|support|official|verified)$'
       OR v IN ('mod', 'mods', 'help', 'helpdesk', 'security', 'system', 'root', 'owner', 'founder')
  )
$$;
REVOKE ALL ON FUNCTION public.name_is_reserved(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.name_is_reserved(text) TO service_role;

CREATE OR REPLACE FUNCTION public.profiles_name_rules() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  trusted boolean := public.guarded_write_allowed();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.username IS NOT NULL AND (public.name_is_reserved(NEW.username) OR NEW.username ~ '[^[:ascii:]]') THEN
      NEW.username := 'user_' || substring(NEW.id::text, 1, 8);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.username IS NOT NULL AND NEW.username IS DISTINCT FROM OLD.username THEN
    IF public.name_is_reserved(NEW.username) THEN
      RAISE EXCEPTION 'That username is reserved. Try another.' USING ERRCODE = 'check_violation', HINT = 'name_rule';
    END IF;
    IF NOT trusted AND NEW.username !~ '^[A-Za-z0-9_-]{3,30}$' THEN
      RAISE EXCEPTION 'Username must be 3 to 30 letters, numbers, hyphens or underscores.' USING ERRCODE = 'check_violation', HINT = 'name_rule';
    END IF;
  END IF;

  IF NEW.business_name IS NOT NULL AND NEW.business_name IS DISTINCT FROM OLD.business_name
     AND public.name_is_reserved(NEW.business_name) THEN
    RAISE EXCEPTION 'That business name is reserved. Try another.' USING ERRCODE = 'check_violation', HINT = 'name_rule';
  END IF;

  IF NEW.shop_slug IS NOT NULL AND NEW.shop_slug IS DISTINCT FROM OLD.shop_slug THEN
    IF public.name_is_reserved(NEW.shop_slug) THEN
      RAISE EXCEPTION 'That name is reserved. Try another.' USING ERRCODE = 'check_violation', HINT = 'name_rule';
    END IF;
    IF NOT trusted AND NEW.shop_slug !~ '^[a-z0-9_-]{3,60}$' THEN
      RAISE EXCEPTION 'That shop address is not allowed.' USING ERRCODE = 'check_violation', HINT = 'name_rule';
    END IF;
  END IF;

  -- Blanking the name would otherwise reset the rename limit.
  IF NOT trusted AND NEW.shop_name IS NULL AND OLD.shop_name IS NOT NULL THEN
    RAISE EXCEPTION 'A store needs a name.' USING ERRCODE = 'check_violation', HINT = 'name_rule';
  END IF;

  IF NEW.shop_name IS NOT NULL AND NEW.shop_name IS DISTINCT FROM OLD.shop_name THEN
    IF public.name_is_reserved(NEW.shop_name) THEN
      RAISE EXCEPTION 'That name is reserved. Try another.' USING ERRCODE = 'check_violation', HINT = 'name_rule';
    END IF;
    IF NOT trusted THEN
      IF NEW.shop_name !~ '^[A-Za-z0-9_]{3,20}$' OR NEW.shop_name !~ '[A-Za-z]' THEN
        RAISE EXCEPTION 'One word: 3 to 20 letters, numbers and _ only, with at least one letter.' USING ERRCODE = 'check_violation', HINT = 'name_rule';
      END IF;
      IF OLD.shop_name IS NOT NULL
         AND OLD.shop_name_updated_at > now() - interval '90 days'
         AND EXISTS (SELECT 1 FROM public.orders WHERE seller_id = NEW.id AND status = 'completed') THEN
        RAISE EXCEPTION 'You can rename your shop once every 90 days.' USING ERRCODE = 'check_violation', HINT = 'name_rule';
      END IF;
    END IF;
    NEW.shop_name_updated_at := now();
  ELSIF NOT trusted THEN
    NEW.shop_name_updated_at := OLD.shop_name_updated_at;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.profiles_name_rules() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_name_rules ON public.profiles;
CREATE TRIGGER trg_profiles_name_rules
  BEFORE INSERT OR UPDATE OF username, business_name, shop_slug, shop_name, shop_name_updated_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_name_rules();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_shop_name_lower_key
  ON public.profiles (lower(shop_name)) WHERE shop_name IS NOT NULL;
