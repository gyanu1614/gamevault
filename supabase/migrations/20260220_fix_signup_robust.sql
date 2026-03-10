-- ============================================================
-- Robust fix for signup profile creation
-- This handles missing columns gracefully
-- ============================================================

-- First, ensure all needed columns exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Make username unique if not already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_username_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END $$;

-- Create a simple, foolproof version of handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  username_value TEXT;
  full_name_value TEXT;
  avatar_url_value TEXT;
BEGIN
  -- Extract values with fallbacks
  username_value := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1),
    'user_' || substring(NEW.id::text, 1, 8)
  );

  full_name_value := NEW.raw_user_meta_data->>'full_name';
  avatar_url_value := NEW.raw_user_meta_data->>'avatar_url';

  -- Try to insert, handle conflicts gracefully
  BEGIN
    INSERT INTO public.profiles (
      id,
      username,
      full_name,
      avatar_url,
      email,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      username_value,
      full_name_value,
      avatar_url_value,
      NEW.email,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      username = COALESCE(EXCLUDED.username, profiles.username),
      updated_at = NOW();
  EXCEPTION
    WHEN unique_violation THEN
      -- If username is taken, append random suffix
      INSERT INTO public.profiles (
        id,
        username,
        full_name,
        avatar_url,
        email,
        created_at,
        updated_at
      )
      VALUES (
        NEW.id,
        username_value || '_' || substring(md5(random()::text), 1, 4),
        full_name_value,
        avatar_url_value,
        NEW.email,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email, updated_at = NOW();
    WHEN OTHERS THEN
      -- Log error but don't fail the auth signup
      RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates profile on signup. Handles errors gracefully with EXCEPTION blocks.';
