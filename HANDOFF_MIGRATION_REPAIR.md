# Handoff — repair Supabase migration history so `db push` is usable again

## The problem (diagnosed 2026-08-13)
`npx supabase db push` wants to replay **~160 migrations** — the entire
`supabase/migrations/` folder — because the **remote migration-tracking table
(`supabase_migrations.schema_migrations`) is empty / out of sync**. In reality
every one of those migrations was **already applied by hand via the Supabase SQL
Editor** over months of development. The CLI just has no record of it.

**DANGER:** running `supabase db push` in this state would re-execute all 160
migrations against the **live production DB** — `create table`, `alter`, RLS
resets, triggers, and **data backfills**. Re-running them will error (objects
already exist) and some could corrupt or reset live data. **Do NOT run
`supabase db push` until the history is repaired.**

Confirmed: everything through `20260813130000_sab_price_display_materialized.sql`
is ALREADY LIVE (applied by hand). There is nothing genuinely un-applied right
now — the folder and the DB are in sync *content-wise*; only the *tracking table*
disagrees.

## The goal
Make the remote `schema_migrations` table know that all existing migrations are
already applied, WITHOUT re-running any of them — so future `db push` only runs
genuinely new files.

## Preconditions / gather first
- Confirm CLI auth + project link: `npx supabase projects list`, check
  `supabase/config.toml` `project_id`, `npx supabase link` if needed.
- **Take a DB backup / snapshot first** (Supabase dashboard -> Database ->
  Backups) before ANY history change. Non-negotiable.
- Read the current remote state: `npx supabase migration list` — it shows Local
  vs Remote columns. Every local migration will show missing on Remote. That
  confirms the diagnosis.

## Two repair paths (pick one — evaluate in the new chat)

### Path A — `migration repair` (mark all as applied, surgical)
Tell the tracking table each version is applied, without executing it:
```
npx supabase migration repair --status applied <version>
```
`<version>` is the numeric prefix of each file. ~160 of them, so script the list
from `ls supabase/migrations/` (strip to the version prefix). `repair` only
writes to `schema_migrations`; it does NOT run the migration SQL. Verify with
`npx supabase migration list` afterwards (all should show applied on Remote).
- Pro: keeps the existing files as the canonical history.
- Con: ~160 invocations (batch them); a few filenames share a timestamp prefix
  (e.g. two `20260628_*`, two `20260730120000_*`) — handle carefully.

### Path B — baseline from live schema (`db pull`, clean slate)
```
npx supabase db pull            # dumps the live schema into ONE new baseline migration
```
This creates a single migration representing the current live schema and marks
the history as baselined. Then the old 160 files are superseded.
- Pro: one clean baseline; future pushes are simple.
- Con: rewrites the migration story; must confirm the pulled schema matches
  expectations (diff review), and decide what to do with the old files
  (archive to a folder, don't delete blindly).

## Recommendation
Lean **Path A** if you want to preserve the granular migration files as history
(safer, non-destructive to the folder). Lean **Path B** if you want a clean
baseline and don't care about the granular files. Either way: **backup first,
run `migration list` before and after, never `db push` until `migration list`
shows Remote fully in sync.**

## Hard rules for the new chat
- Backup before touching `schema_migrations`.
- NEVER `supabase db push` until repair is done and verified.
- `repair --status applied` must NOT be confused with actually running SQL — it
  only updates tracking. But double-check each version is truly already live
  before marking it applied (spot-check a few tables/functions exist).
- The user applies all DDL via the SQL Editor historically — so even after this
  repair, confirm the intended workflow (CLI vs SQL editor) going forward.

## Context that led here
The materialized price-catalog fix (sab_price_display) was shipped via the SQL
Editor precisely BECAUSE `db push` was unusable. That fix is already live. This
repair is the cleanup so the next schema change can go through the CLI normally.
Related worktree: .claude/worktrees/sab-price-accuracy (branch
sab-card-image-float), where the price-perf work happened.
