-- LOCAL-ONLY seed (runs on `supabase db reset`, never pushed).
--
-- Production already has this trigger on auth.users (created before the
-- baseline migration, which does not dump the auth schema). Local stacks
-- did not, so a Google/Discord sign-in on localhost created an auth user
-- with no profiles row. The function itself IS in the migrations
-- (public.handle_new_user); only the trigger wiring is missing locally.
-- Guard suites still insert their own profile when none exists, so this is
-- additive for them.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
