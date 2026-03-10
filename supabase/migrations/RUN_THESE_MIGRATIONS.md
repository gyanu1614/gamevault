# Migrations to Run for Signup & Avatar Fix

Run these migrations in your Supabase SQL Editor in this order:

## 1. Fix Avatar Storage RLS Policies
**File**: `20260220_fix_avatar_storage_rls.sql`

This creates proper RLS policies that allow:
- Authenticated users to upload avatars to their own folder (`{user_id}/avatar.png`)
- Public read access to all avatars
- Users to update/delete their own avatars

## 2. Add Guest Support to Profiles
**File**: `20260220_add_guest_support.sql`

This adds:
- `is_guest` column to profiles table
- Updates the trigger to handle guest checkout metadata

## 3. Improve Trigger Logging
**File**: `20260220_improve_trigger_logging.sql`

This updates the `handle_new_user()` trigger with:
- Better metadata extraction for `username`, `full_name`, `avatar_url`
- Detailed logging for debugging
- Proper handling of conflicts and edge cases

---

## How to Apply

1. Go to your Supabase Dashboard → SQL Editor
2. Copy the contents of each migration file
3. Paste and run them in order
4. Verify each one completes successfully

## Expected Result

After running these migrations:
- ✅ Signup will save username and full name to profile
- ✅ Avatar uploads will work in settings page
- ✅ Guest checkout will work properly
- ✅ Proper RLS security for avatar storage
