-- ============================================================
-- Add guest checkout support to profiles
-- ============================================================

-- Add is_guest column if it doesn't exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;

-- Add index for guest profiles
CREATE INDEX IF NOT EXISTS idx_profiles_is_guest ON public.profiles(is_guest)
  WHERE is_guest = TRUE;

-- Update the handle_new_user function to support guest metadata
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
  is_guest_value BOOLEAN;
BEGIN
  -- Extract values with fallbacks
  username_value := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1),
    'user_' || substring(NEW.id::text, 1, 8)
  );

  full_name_value := NEW.raw_user_meta_data->>'full_name';
  avatar_url_value := NEW.raw_user_meta_data->>'avatar_url';

  -- Check if this is a guest user
  is_guest_value := COALESCE((NEW.raw_user_meta_data->>'is_guest')::BOOLEAN, FALSE);

  -- Try to insert, handle conflicts gracefully
  BEGIN
    INSERT INTO public.profiles (
      id,
      username,
      full_name,
      avatar_url,
      email,
      is_guest,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      username_value,
      full_name_value,
      avatar_url_value,
      NEW.email,
      is_guest_value,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      username = COALESCE(EXCLUDED.username, profiles.username),
      is_guest = EXCLUDED.is_guest,
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
        is_guest,
        created_at,
        updated_at
      )
      VALUES (
        NEW.id,
        username_value || '_' || substring(md5(random()::text), 1, 4),
        full_name_value,
        avatar_url_value,
        NEW.email,
        is_guest_value,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET
        email = EXCLUDED.email,
        is_guest = EXCLUDED.is_guest,
        updated_at = NOW();
    WHEN OTHERS THEN
      -- Log error but don't fail the auth signup
      RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON COLUMN public.profiles.is_guest IS 'TRUE if this account was created via guest checkout and user has not claimed it';
