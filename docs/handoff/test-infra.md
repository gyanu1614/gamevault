# Handoff — per-worktree test stacks (chore/test-infra)

## What changed
- **One Supabase stack per worktree.** `scripts/local-stack.mjs` (+ pure half `scripts/lib/local-stack.mjs`). Main checkout = slot 0: committed `config.toml`, unchanged. Other worktrees get a slot from `~/gamevault/.git/local-stacks.json`, project id `gamevault-<folder>`, ports `54320 + 100×slot`, written to the gitignored `supabase/.env`. The CLI loads that file on every command, so even a raw `supabase db reset` in a worktree hits its own stack.
- **Lean by default** in worktrees: no studio/pg-meta/analytics/vector/realtime/edge/imgproxy (config overrides; CLI 2.109 ignores `start -x`, and analytics got OOM-killed on the first try). `--full` runs everything.
- **Fee reseed is now a seed file**, `supabase/seeds/fee_rules.local.sql`, not migration re-runs. It writes the pair-scope rows the two fee migrations can't write on an empty catalogue, reads the PR 4 start from the DB, and is idempotent. Proven **row-for-row identical** (41 = 41, 0 diffs) to the old re-apply recipe, in a rolled-back transaction.
- **Fixture namespaces** (`src/test/guards/fixture-namespace.ts`). Every fixture id carries a 4-char key from its test file's path. Residue checks and purges look only at that key. `makeFixture` purges stale rows from a crashed earlier run of the same file, and `audit_logs` goes through the shared psql `purgeAuditLogs` (local only). This replaces the hand-rolled copies in checkout-fix-a/b.
- `setup-env.ts` derives `SUPABASE_DB_URL` (api port + 1) when `.env.test` lacks it, so psql suites never fall back to main's `:54322`.
- CLAUDE.md: new section "Local Supabase: one stack per worktree", plus a fixture rule. Stale `npx supabase start` hints are updated.
- **No migration files, no `config.toml`, no app/money code changed.**

## Commands
| | |
|---|---|
| `pnpm db:up [--full]` | start this worktree's stack, write `supabase/.env` + `.env.test` |
| `pnpm test:reset` | db reset → `seed:games --env=local` → fee seed → counts (fails on any resolver gap) |
| `pnpm test:full` | `test:reset`, then the whole suite |
| `pnpm db:list` | every stack: slot, ports, containers, memory, worktree |
| `pnpm db:down [--purge]` | stop (keep data) / delete data + free the slot |

## Ports per worktree
- main `~/gamevault`: slot 0, api 54321, db 54322, studio 54323 (as before)
- `gamevault-devinfra`: slot 12, api 55521, db 55522
- New worktree: slot from a hash of its folder name, probing past taken or bound ports. db = api + 1.
- Cost: lean stack ~0.6 GB idle, ~2.5% CPU. Full stack 1.1–1.7 GB. Docker has 3.9 GB, so run at most ~3 lean stacks next to main's.

## Test results (this worktree, fresh stack, main + postdeploy stacks running)
- `tsc --noEmit`: clean
- `pnpm test:full` #1 (pre-docs): reset 72 s → games 233 · pairs 405 · fee rules 41 · resolver gaps 0. **192 files passed, 1 skipped · 1707 tests passed, 2 skipped, 0 failed.** 4 min 02 s total.
- `pnpm test:full` #2 (final, after merging origin/main incl. #93's new migration + guard): reset 57 s → 233 · 405 · 41 · 0 gaps. **194 files passed, 1 skipped · 1724 tests passed, 2 skipped, 0 failed.** 2 min 58 s total.
- Main stack untouched throughout (its db container up 3 h, still 233/405/41).

## Stale `.claude/worktrees` (step 4)
Snapshots are local refs `refs/wip-backup/<name>` (tracked + untracked working tree on top of HEAD; never pushed). Ignored files (`.env*`, `art/`, `growth/`, `HANDOFF_PSP_ONBOARDING.md`, eldorado-debug, `.claude/*.json`) are in `~/gamevault/.git/wip-backup/2026-09-23/<name>-ignored.tar.gz` (chmod 600).
| worktree | branch | dirty | action |
|---|---|---|---|
| dropmarket-shop-redesign-c7a812 | claude/dropmarket-shop-redesign-c7a812 | 11 | snapshot + removed |
| game-icons-step-1e-5a92f5 | detached 937f6c4e (in main) | 0 | removed |
| sab-price-accuracy | sab-card-image-float (1 unpushed commit, kept on branch) | 3 | snapshot + removed |
| vercel-cpu-audit-dd07c1 | detached 99751763 (in main) | 0 | removed |
| hopeful-allen-9c864b | homepage-reset | 23 | snapshot, **kept**: edited 2026-09-23 02:45 (active?) |
| delivery-fade | fix/delivery-instructions-fade | 16 | snapshot, **kept**: `next dev -p 3971` running (pid 57823) |
`git worktree prune` ran. Branches untouched. Restore: `git worktree add ../x <branch> && cd ../x && git diff --binary HEAD refs/wip-backup/<name> | git apply`.
Note: snapshotting reset the git index (staged → unstaged) in the two kept worktrees; file contents unchanged.

## Manual steps for Gyanu
1. Merge the PR. Then in **every open worktree**: `pnpm install && pnpm db:up && pnpm test:reset`.
2. `~/gamevault-postdeploy` hand-edited `supabase/config.toml` (project id + 544xx ports): revert it (`git checkout supabase/config.toml`), `supabase stop`, then `pnpm db:up`.
3. Decide on homepage-reset and delivery-fade: stop the dev server on :3971, then `git worktree remove --force .claude/worktrees/<name>` (snapshots already taken).
4. Optional: the `sab-price-accuracy` `.env.local` held `DISCORD_*` + `SAB_MARKET_IMPORT_SECRET`, which main's `.env.local` lacks. They're in its tarball if you still need them.
