# DropMarket

## Skill usage (apply automatically, never ask)
- UI/component work → design-taste-frontend (primary) + frontend-design; apple-design for motion, gestures, touch feel; ui-ux-pro-max only for palette/font choices; review with web-design-guidelines before finishing
- Any React/Next code → vercel-react-best-practices
- Unsure about a library API → context7 first, never guess
- New feature or bug → superpowers (brainstorm → plan → TDD → verify)
- Payment, auth, or user-data code → security-guidance must pass before finishing
- Pages, metadata, listings → seo (router) and its sub-skills
- Be concise. Prefer grep/glob over reading whole files. Show evidence, not claims.

## Package manager: pnpm (never npm)
- This repo uses **pnpm**. `pnpm-lock.yaml` is the only lockfile; there is no `package-lock.json`. Never run `npm install`/`npm ci` — it writes a second lockfile and a flat `node_modules` that hides the strictness bugs pnpm catches.
- **Every worktree runs `pnpm install`** before anything else. A fresh worktree has no `node_modules`, and pnpm's is a symlink farm — it cannot be copied or shared from another worktree.
- CI installs with `pnpm install --frozen-lockfile`: if `package.json` and the lockfile disagree the run fails instead of silently resolving. Commit `pnpm-lock.yaml` with any dependency change.
- pnpm settings live in **`pnpm-workspace.yaml`**, not `package.json` — pnpm 11+ ignores the `pnpm` field and npm's top-level `overrides`. The `ws` pin and the `allowBuilds` list are there.
- pnpm **blocks dependency install scripts by default**. A new dep that needs a postinstall (native binary, CLI download) must be added to `allowBuilds` in `pnpm-workspace.yaml` or it installs silently broken.
- pnpm forwards script args natively: `pnpm sab:eldorado:send --max-pages 10`, **not** `pnpm ... -- --max-pages 10` (the `--` is passed through as a literal argument).
- Vercel: set the Install Command to `pnpm install --frozen-lockfile` in the dashboard (Settings → General → Build & Development Settings).

## Tests & environment (never bypass)
- `vitest` loads **`.env.test`** by default: local Supabase, **no `RESEND_API_KEY`**, dummy provider keys. Set it up once: `cp .env.test.example .env.test` then `pnpm supabase start`.
- `.env.test` is gitignored; **`.env.test.example` is committed**. Never put a real secret in either.
- `ALLOW_REMOTE_GUARD_TESTS=1` is the ONLY way to load `.env.local` (production Supabase + live keys) into a test run. Use it deliberately, never to "make a failing test pass".
- A test that touches email **must** `vi.mock('@/lib/email')`. Real sends throw from a test run (`src/lib/email/transport-guard.ts`).
- Integration tests that create rows must call `assertGuardTargetAllowed` before writing, and must clean up **every** row they cause — including rows written by side effects (notifications, ledger), not just the ones they insert directly.
- Why: on 2026-09-12 a plain `vitest run` emailed real sellers and left 32 orphaned notifications on production accounts for ~2 months. `setup-env.ts` had loaded `.env.local` unconditionally.

## Migration timestamps
- Migration timestamps use the **real current second** (`date +%Y%m%d%H%M%S`), never a round number like `…100000`. Two chats on the same day both reaching for `100000` collide.
- A collision is **silent**: the Supabase CLI compares version numbers only, so the second file with the same version is skipped on remote and never applied. On 2026-09-16 `20260916100000_seed_global_categories` was skipped this way because `feat/rate-limits` had already pushed `20260916100000_rate_limits`.
- Check the **ordering** before picking the second, not just uniqueness. A migration that seeds rows must still sort before one that corrects them; `date` alone puts a rename at "now", which can jump it past its dependants and silently undo them.

## Database functions & grants (from migration 20260913100000)
- New SQL functions in `public` are **service-role-only by default** (the default `EXECUTE` grant to anon/authenticated is revoked). A function the browser or a session client must call needs an explicit `GRANT EXECUTE ON FUNCTION … TO authenticated` (or `anon`) in its migration **and** an entry in the allow-list in `src/test/guards/db-p0-grants.guard.integration.test.ts` — the posture test fails otherwise.
- Every `SECURITY DEFINER` function pins `SET search_path = public`. Views are created `WITH (security_invoker = true)`.
- Cron/admin routes must call RPCs through `createServiceRoleClient()`; the session client has no cookies on a Vercel cron request and runs as anon.
- Why: on 2026-09-11 the audit found 39 definer functions and 10 views open to the anon key (tax ids, delivery codes, order state) because the baseline granted `EXECUTE` by default.

## Categories: one system (from migration 20260917190852, Step 1b)
- `global_categories` (taxonomy: 5 primaries + sub-categories with `parent_id`, `default_type`, `default_slug`) + `game_categories` (the per-game row: `slug`, `name`, `type`, copy, icons, `sort_order`, `is_enabled`) are the ONLY category tables the app reads or writes. `listings.game_category_id` is the FK the app uses.
- Create or enable a (game, category) pair ONLY through `ensureGameCategory` (`src/lib/categories`). Seller publish paths gate on `findEnabledGameCategory` with the session client and never write the catalogue (AUTH-010).
- Pickers (nav, sell wizard, template builder, admin) list `global_categories` with `.is('parent_id', null)` — a guard test fails otherwise.
- `public.categories` and `listings.category_id` still exist during Phase A as a mirror maintained by two DB triggers (`trg_game_categories_mirror_legacy`, `trg_listings_category_sync`). Never read or write them from app code; Phase B (draft in `supabase/migrations_draft/`) drops them.
- `type` is a CHECK-constrained column (`currency|items|account|top_up|service|gift_card`) — the fee/warranty key. Never put it, or anything a query filters on, in `extras` JSON.

## Money seams are single SQL functions (from migration 20260914100000)
- Order cancel + wallet-hold return, order refund + wallet credit, withdrawal cancel/reject, inventory claim, promo usage: each is ONE service-role RPC (`order_cancel_return_wallet`, `order_refund_to_wallet`, `withdrawal_cancel`, `withdrawal_reject`, `inventory_claim_for_order`, `promo_usage_record`). Never re-compose these as two calls from TypeScript; call the RPC (TS seam: `src/lib/wallet/order-money.ts`).
- `money_fault_hook(point)` exists ONLY for tests: it raises when the transaction-local GUC `app.money_fault` equals `point`. PostgREST callers cannot set that GUC, so it is inert in the app; the GREEN tests set it from a psql transaction (`src/test/guards/money-atomicity.guard.integration.test.ts`, `withFault`) to prove a failure inside an atomic function leaves no partial state. Keep every new money function's interior steps behind a `PERFORM money_fault_hook('<fn>:<point>')` so the same proof can be written for it.
- A `failed` webhook event is re-claimed by `webhook_event_claim` on the provider's retry; there is no replay worker. A dispatch failure must throw (router → 500), never be swallowed.
- Why: on 2026-09-11 the audit (DB-015/016/017) found every money seam composed two atomic RPCs with no compensation; reproduced on the local stack 2026-09-14: stranded wallet holds, lost refund credits, "Funds stay in your wallet" on a paid-out hold, one code sold to two buyers.
