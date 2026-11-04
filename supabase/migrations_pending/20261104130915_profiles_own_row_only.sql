-- NOT A LIVE MIGRATION. Held in supabase/migrations_pending/ until the code that
-- stopped reading other people's rows through `profiles` is deployed. It ships by a
-- `git mv` into supabase/migrations/, unchanged, then `supabase db push`. Pushed before
-- that code, signed-in users would see blank seller and buyer names until the deploy.
--
-- DLT-001b: a signed-in user reads their own profile row and nobody else's.
--
-- Until now `profiles_public_projection_read` was USING (true) with SELECT on every
-- column, so any signed-in user could read every user's email, payout email, balances,
-- KYC state, Stripe ids and restriction reason with the public anon key and their own
-- session (20260921004158 left this open on purpose and named the fix DLT-001b).
--
-- That migration planned to narrow the column grant and move own-row reads to an RPC.
-- Column grants apply to the whole role: they would also have broken every staff read
-- of an email and every security_invoker admin view, about 40 places, each with a hard
-- error. Closing it by row is smaller and closes every private column at once:
--
--   · your own row stays readable in full (auth hook, settings, wallet: no change);
--   · staff with two-factor stay readable through is_admin() (no change);
--   · other people's display details come from public_profiles, which has no private
--     columns. It has to read past these row rules, so it stops being security_invoker.
--     The one view in `public` that does: the column list in it is the whole boundary.
--     Adding a column there makes it readable by anyone.

ALTER VIEW public.public_profiles SET (security_invoker = false);

COMMENT ON VIEW public.public_profiles IS
  'DLT-001: the only way to read another person''s profile outside staff and the service role. Runs as its owner, past the row rules on profiles, so the column list is the whole boundary: display columns only, no email, paypal_email, balances, KYC, Stripe ids or restriction state. Adding a column here makes it readable by anyone; public-profiles.guard.integration.test.ts pins the sensitive set.';

DROP POLICY IF EXISTS profiles_public_projection_read ON public.profiles;

-- Evaluated once per query, not once per row: with the open policy gone these two are
-- the whole read rule, and staff screens read many rows.
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS profiles_admin_read ON public.profiles;
CREATE POLICY profiles_admin_read ON public.profiles
  FOR SELECT TO authenticated
  USING ((select public.is_admin()));

-- generate_shop_slug runs as the caller and has to see every seller's slug to avoid
-- them. Its grants carry over.
CREATE OR REPLACE FUNCTION public.generate_shop_slug(name text) RETURNS text
  LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase, replace spaces/special chars with hyphens
  base_slug := lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'));

  -- Remove leading/trailing hyphens
  base_slug := trim(both '-' from base_slug);

  -- Start with base slug
  final_slug := base_slug;

  -- Check for uniqueness and append number if needed
  WHILE EXISTS (SELECT 1 FROM public.public_profiles WHERE shop_slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$;

-- Proof: the view must read past the row rules, or every signed-in user's seller and
-- buyer names go blank. It only can if its owner bypasses RLS or owns an unforced table.
DO $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT (r.rolbypassrls OR c.relowner = v.relowner) AND NOT c.relforcerowsecurity
    INTO v_ok
    FROM pg_class c
    JOIN pg_class v ON v.oid = 'public.public_profiles'::regclass
    JOIN pg_roles r ON r.oid = v.relowner
   WHERE c.oid = 'public.profiles'::regclass;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'DLT-001b: public_profiles cannot read past the row rules on profiles';
  END IF;
END $$;
