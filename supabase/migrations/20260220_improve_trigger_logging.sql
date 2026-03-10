-- ============================================================
-- Improve handle_new_user trigger with better logging
-- ============================================================

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
  is_guest_value := COALESCE((NEW.raw_user_meta_data->>'is_guest')::BOOLEAN, FALSE);

  -- Log what we're about to insert (for debugging)
  RAISE LOG 'Creating profile for user % with username=%, full_name=%, avatar_url=%',
    NEW.id, username_value, full_name_value, avatar_url_value;

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
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
      is_guest = EXCLUDED.is_guest,
      updated_at = NOW();

    RAISE LOG 'Profile created successfully for user %', NEW.id;
  EXCEPTION
    WHEN unique_violation THEN
      -- If username is taken, append random suffix
      RAISE LOG 'Username collision for %, appending suffix', username_value;

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
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        is_guest = EXCLUDED.is_guest,
        updated_at = NOW();

      RAISE LOG 'Profile created with modified username for user %', NEW.id;
    WHEN OTHERS THEN
      -- Log error but don't fail the auth signup
      RAISE WARNING 'Error creating profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

-- Recreate trigger to ensure it's using the latest function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates profile on signup. Handles guest users and metadata extraction. Includes detailed logging for debugging.';
