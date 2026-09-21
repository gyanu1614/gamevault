# `supabase/migrations_pending/`

Migrations that are **finished and reviewed** but must not be applied yet
because they depend on code that is not deployed.

The Supabase CLI only reads `supabase/migrations/`, and **`supabase db push`
applies every pending file in that directory in one go**. There is no way to
push a subset. So a migration that must land *after* a specific deploy cannot
sit in `migrations/` at all — it would ride along with the next push.

This directory is the holding area. A file here is:

- **complete** — not a draft, not a sketch; it is the exact text that will run
- **ordered** — its `YYYYMMDDHHMMSS` filename already sorts correctly against
  what is in `migrations/`, so it needs no rename when it ships
- **shipped by a move, not an edit** — a follow-up PR `git mv`s it into
  `migrations/` unchanged, and that PR's merge is the deploy gate

This differs from `supabase/migrations_draft/`, which holds work that is not
finished or whose preconditions have not been met yet (e.g. the categories
Phase B contract, which waits on a week of clean Phase A data).

## Why not just delay the whole PR?

Because the code and the schema need to land in *opposite* orders:

- the additive half (create a view) must be applied **before** the code that
  reads it, or the new code 404s
- the destructive half (revoke a grant) must be applied **after** the code that
  stopped using it, or the old code 42501s

One PR cannot satisfy both. Splitting the migration and holding the second half
here is what lets each land at the right moment, with no window in which either
side is broken.

## Current contents

| File | Blocked on | Ships via |
|---|---|---|
| `20260921151722_public_profiles_revoke_anon.sql` | PR #81's code being live in production | PR #82 (`git mv` into `migrations/`, unchanged) |
