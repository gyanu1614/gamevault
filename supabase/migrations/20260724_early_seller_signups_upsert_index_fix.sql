-- Fix early-seller waitlist submissions failing with Postgres 42P10:
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
--
-- submitEarlySeller upserts with { onConflict: 'email' }, which PostgREST sends
-- as ON CONFLICT (email). Postgres can only infer that conflict target from a
-- unique index defined on the bare `email` column, but 20260724_early_seller_
-- signups.sql created it on the expression lower(email) — so no index matched
-- and every submission failed.
--
-- The server action lowercases the address before writing, so a plain unique
-- index on `email` preserves the same one-signup-per-address guarantee.
-- PostgREST's on_conflict parameter accepts column names only and cannot
-- express lower(email), so the index is the side that has to change.

-- Belt-and-braces: rows written before this fix should already be lowercase
-- (the action normalises), but make sure before adding the unique index.
update public.early_seller_signups
   set email = lower(email)
 where email <> lower(email);

drop index if exists public.early_seller_signups_email_key;

create unique index if not exists early_seller_signups_email_key
  on public.early_seller_signups (email);
