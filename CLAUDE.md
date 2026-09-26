# DropMarket

## Skill usage (apply automatically, never ask)
- UI/component work → design-taste-frontend (primary) + frontend-design; apple-design for motion, gestures, touch feel; ui-ux-pro-max only for palette/font choices; review with web-design-guidelines before finishing
- Any React/Next code → vercel-react-best-practices
- Unsure about a library API → context7 first, never guess
- New feature or bug → superpowers (brainstorm → plan → TDD → verify)
- Payment, auth, or user-data code → security-guidance must pass before finishing
- Pages, metadata, listings → seo (router) and its sub-skills
- Be concise. Prefer grep/glob over reading whole files. Show evidence, not claims.

## Homepage surface rule
Homepage sections share one page surface. A section may vary perceived depth through ambient light, character art with fade masks on every edge, or vertical rhythm — never through a border, a box, or its own background colour. Any image either carries a fade mask on all edges or is a contained component whose clipping reads as local. Card, chip, and input borders are component-level and unaffected.

## Section authoring contract
The `.page-rhythm` container (globals.css) owns vertical rhythm (gap-20 sm:gap-32) and the content measure (max-w-7xl + px-4 sm:px-6 lg:px-8). Every section is a direct child and inherits both.

- **Sections contain content only.** No vertical padding, no margin, no max-width, no horizontal padding, no `overflow-hidden`, no border, no background colour. If a section needs any of these, the need is in the wrong place — fix the container or the component inside it.
- **Full-bleed is opt-in.** Mark a direct child `data-bleed` to escape the measure. Only the pre-footer CTA band and background artwork qualify.
- **Section headers are one row** *when they carry an action link*: heading left-aligned, link right-aligned, same row, baseline-aligned. A section with **no** action link centres its title instead — it reads as a page-level title rather than a list header.
- **Section titles are the one place type may scale with the viewport** — a modest `clamp()`. Everything else stays fixed px.
- **Background artwork is oversized and offset** so it exits at least one edge, sits behind content, and carries a fade mask on *every* edge — never a hard crop from a parent's `overflow-hidden`. Horizontal bleed that would cause page-level scroll is contained with `overflow-x-clip` (x-axis only; `clip` keeps y visible so ambient light still crosses section boundaries).
- **Card, chip and input borders are component-level** and unaffected by any of the above.

## Artwork
- **The image carries its own normalising filter. The gradient assumes a normalised input and is NOT tuned per image.** Art is swapped per game, so a gradient tuned to one screenshot breaks on the next — a bright plate blows out, a dark one vanishes. The `<img>` gets `HERO_ART_NORMALISE` (`brightness(0.4) saturate(0.6)`, defined in `HeroArtLayer.tsx`) so every source lands at a similar value first. **If a plate reads wrong, adjust the filter — never the gradient stops.**
- Fade stack, in order: darken the art → tint toward base with a blended layer → gradient overlay → clip.
- The gradient must reach the page background **token**, never an approximate hex, well before the clip point, so the clip edge is invisible.
- The art is heavily suppressed everywhere and merely *least* covered at its brightest point — never more than ~10% visible.
- Art is oversized and positioned to exit at least one edge. Never sized to fit its container.
- Any effects layer (grain, glow, noise, sheen) sits **inside** the fading stack, or it paints past the boundary and creates a seam. This has bitten us: a sheen ending at the clip produced a measured +8/channel step.
- Verify boundaries by sampling pixels either side — they must be identical.
## Package manager: pnpm (never npm)
- This repo uses **pnpm**. `pnpm-lock.yaml` is the only lockfile; there is no `package-lock.json`. Never run `npm install`/`npm ci` — it writes a second lockfile and a flat `node_modules` that hides the strictness bugs pnpm catches.
- **Every worktree runs `pnpm install`** before anything else. A fresh worktree has no `node_modules`, and pnpm's is a symlink farm — it cannot be copied or shared from another worktree.
- CI installs with `pnpm install --frozen-lockfile`: if `package.json` and the lockfile disagree the run fails instead of silently resolving. Commit `pnpm-lock.yaml` with any dependency change.
- pnpm settings live in **`pnpm-workspace.yaml`**, not `package.json` — pnpm 11+ ignores the `pnpm` field and npm's top-level `overrides`. The `ws` pin and the `allowBuilds` list are there.
- pnpm **blocks dependency install scripts by default**. A new dep that needs a postinstall (native binary, CLI download) must be added to `allowBuilds` in `pnpm-workspace.yaml` or it installs silently broken.
- pnpm forwards script args natively: `pnpm sab:eldorado:send --max-pages 10`, **not** `pnpm ... -- --max-pages 10` (the `--` is passed through as a literal argument).
- Vercel: set the Install Command to `pnpm install --frozen-lockfile` in the dashboard (Settings → General → Build & Development Settings).

## Tests & environment (never bypass)
- `vitest` loads **`.env.test`** by default: local Supabase, **no `RESEND_API_KEY`**, dummy provider keys. `pnpm db:up` creates it (from `.env.test.example`) pointed at this worktree's own stack — see the next section.
- `.env.test` is gitignored; **`.env.test.example` is committed**. Never put a real secret in either.
- `ALLOW_REMOTE_GUARD_TESTS=1` is the ONLY way to load `.env.local` (production Supabase + live keys) into a test run. Use it deliberately, never to "make a failing test pass".
- A test that touches email **must** `vi.mock('@/lib/email')`. Real sends throw from a test run (`src/lib/email/transport-guard.ts`).
- Integration tests that create rows must call `assertGuardTargetAllowed` before writing, and must clean up **every** row they cause — including rows written by side effects (notifications, ledger), not just the ones they insert directly.
- Mint fixture ids through the file's namespace (`makeFixture()` does; extra ids via `fx.ns` / `fixtureNamespace()` in `src/test/guards/fixture-namespace.ts`). Teardown residue checks and purges cover **only that file's key**; `audit_logs` rows go through `purgeAuditLogs` (psql, local only). Never write a global `guardtest-%` sweep into a suite's teardown.
- Why: on 2026-09-12 a plain `vitest run` emailed real sellers and left 32 orphaned notifications on production accounts for ~2 months. `setup-env.ts` had loaded `.env.local` unconditionally.

## Local Supabase: one stack per worktree (from 2026-09-23)
- **Start:** `pnpm db:up` in the worktree (after `pnpm install`). The main checkout stays slot 0 (committed `config.toml`, ports 54320–54329, all services). Every other worktree gets a slot from `<git common dir>/local-stacks.json`, project id `gamevault-<folder>`, ports `54320 + 100 × slot` (api +1, db +2), and a **lean** service set (no studio/analytics/realtime/edge/imgproxy; `--full` for all). The overrides live in the gitignored `supabase/.env`, which the CLI loads on every command, so even a raw `supabase …` in a worktree targets its own stack.
- **Reset + seed:** `pnpm test:reset` = `supabase db reset` → `seed:games --env=local` → `supabase/seeds/fee_rules.local.sql` → sanity counts read from the DB (games / pairs / fee rules / resolver gaps; fails on any gap). **Never `supabase db reset` directly and never re-run migration files by psql to reseed.** A fee migration that keys rules by pair must add its local rows to that seed file.
- **Full gate:** `pnpm test:full` = `test:reset` then the whole vitest suite.
- **Housekeeping:** `pnpm db:list` (every stack: slot, ports, containers, memory), `pnpm db:down` (stop, keep data), `pnpm db:down --purge` (delete data + free the slot — do this before removing a worktree). Docker has ~3.9 GB: a lean stack is ~0.6 GB idle, a full one 1.1–1.7 GB; stop stacks you are not using.
- **Never hand-edit `supabase/config.toml` ports or `project_id`** for a worktree — `db:up` already isolates it, and the edit would ship in the PR.
- Why: on 2026-09-23 three chats shared main's stack; one worktree's `db reset` wiped another's functions mid-test-run, fixtures leaked between guard suites, and every handoff repeated a manual reseed recipe.

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

## Trend radar: external ids, metrics, review state (from migration 20260918185535, Step 2)
- `game_external_ids` (`platform`, `external_id`; Roblox = universeId) is the ONLY place an external identity lives. Never add a per-platform id column to `games`. Key a game through this table; the radar, icons and Step-3 crawlers all read it.
- `games.review_status` (`pending|approved|rejected|declining`, default `approved`). A `pending` game is ALSO `is_active=false`; visibility relies on the existing `games` RLS (`is_active = true OR service_role`) plus every public reader's `is_active` filter — keep both. Approve/Reject/Snooze go through `src/lib/trend-radar/review.ts` (guarded by `trend-radar-review.guard.integration.test.ts`); the admin actions only add `requireAdmin` + revalidation.
- New games from the radar are created by `src/lib/trend-radar/prepare.ts` and NOWHERE else: `validateGameIdentity` → `games` row (`source='trend-radar'`) → `game_external_ids` (the idempotency key) → `ensureGameCategory` ×2 → `fetchGameIcon({ externalId })` → draft on `trend_events.draft` → Discord. Idempotent-repair, no transaction: a half-prepared pending game is completed on the next run, never deleted.
- Signed internal routes (`/api/internal/trend-radar/{collect,prepare,nightly}`) authenticate with `authorizeInternalRequest` (`src/lib/security/internal-route-auth.ts`: IP rate-limit, then constant-time header compare, 500 when the secret is unset). Use it for every new `/api/internal/*` route. `runtime`/`dynamic`/`maxDuration` must be literals in the route file — Next cannot read them through a re-export.
- Roblox calls go through ONE `createPacer()` per run (1 req/s + jitter); the second 429 throws `RobloxThrottleTripped` and the run ends cleanly with an `endpoint_failure` event. Never retry through a throttle. `games.roblox.com/v1/games` takes ≤50 ids; `games/sorts` and `games/list` are dead (404).
- `src/lib/trend-radar/roblox.ts` and `resolve.ts` are loaded by Node's type-stripper (`pnpm radar:backfill`): keep them free of `@/` imports and of TS-only runtime syntax (parameter properties, enums). Inject the matcher instead; `index.ts` pre-wires it for app code.
- Thresholds are config (`src/lib/trend-radar/config.ts`, `TREND_*` env overrides), and every fired value is kept in `trend_events` — tune from that table, not from memory.

## Public pages are static-first (from Step 7a, 2026-09-19)
- Every public page is ISR or SSG. `scripts/check-public-route-caching.mjs` runs ahead of `next build` (and as `src/test/guards/public-route-caching.guard.test.ts`) and fails the deploy when a public route breaks a rule below. A new per-request public route needs an entry in its `GRANDFATHERED` list with the reason — the same review a `force-dynamic` would get.
- **No cookie client on a public read.** `@/lib/supabase/server` calls `cookies()`; one call anywhere in a page's server import graph makes the whole route `private, no-store`. Public data goes through `@/lib/supabase/anon`. A `'use server'` module that mixes session writes with public reads must be in `MIXED_ACTION_MODULES`, and its public reads must be covered by a behaviour test that mocks the cookie client to throw (`category-page-anon-reads.test.ts`).
- **Personalisation is client-side.** The viewer (self-purchase block, own-listing controls) comes from `useAuth()` in the client component, never from `auth.getUser()` in the page. While auth is loading, send the click through to the protected page rather than to the sign-in dialog.
- **Never read `searchParams` in a public page.** It opts the route out of static rendering even with `revalidate` set. Read the URL in the client through `SearchParamsBridge` (`src/components/navigation/`): the visible tree stays in the static HTML and URL-driven state applies after hydration. A client component that calls `useSearchParams()` directly is client-rendered up to the nearest `<Suspense>` on a static route — the prerendered HTML holds only the fallback (the live `/adopt-me/values` table is missing from its HTML for this reason).
- **Prerender known params; `dynamicParams = false` where the set is closed — AND `notFound()` in the body by the same rule.** Hub routes whose params come from `lib/content/theme` (values, calculator, price-index, methodology, blog) list every slug and close the set. On Vercel `dynamicParams = false` is not enforced at runtime (Next only throws its fallback-false 404 outside minimal mode; verified 2026-09-19 — the preview served `/rust/blog` as a 200 empty hub), so the body must reject an out-of-set slug itself, before its data fan-out (`hasHubPage(...)` / `isBlogHubGame(...)`); ISR then caches that 404. Open sets (items, posts, category pairs) prerender the sitemap's set — `lib/seo/category-pairs.ts`, `lib/seo/indexable-games.ts`, `lib/blog/hub-params.ts` — and serve the long tail on demand into the same cache. Prerender ALL of a bounded set (value items) rather than a "top N"; a cap just moves the render to the first visitor after every deploy.
- **Revalidation is event-driven.** The job that changes the data calls the revalidate route (`/api/internal/values-revalidate?game=<slug>` after every pricing run); the page's `revalidate` is a 24 h safety net, not the refresh. Listing surfaces (Step 7b): every listing mutation — publish, edit, price, delete, moderation verdict, store pause, admin restriction, inventory change, order completion (`transition()`) — calls `revalidateListingSurfaces` (`src/lib/revalidation/listings.ts`); browser-side writers call the session-scoped `revalidateMyListingSurfaces` action instead. `listing-mutations-revalidate.guard.test.ts` finds writers by what they write and pins the set — a new mutation path fails it until it calls the seam or is exempted with a reason. Reads identical across all prerendered pages (paused sellers, test sellers, game directory) are `unstable_cache`d under the tags in `src/lib/revalidation/tags.ts`; `/api/cron/revalidate-listing-pages` (nightly) is the backstop for DB-side changes. `revalidatePath` on a dynamic route takes the ROUTE PATTERN (`/[gameSlug]/values/[itemSlug]`, `'page'`); a concrete segment inside a pattern matches nothing and fails silently.
- **404 before the DB.** A catch-all segment resolves its params first (game → category → SEO slug) and `notFound()`s before any listing/seller/profile read; on ISR the 404 is then cached. `category-route-gate.test.ts` pins this with a recording fake client.
- OG images are `force-static` with `generateStaticParams` for the sitemap set; each cold OG render is a full Satori pass.
- Why: the 2026-09-18 audit found ~13 min/day of Fluid Active CPU on page renders that should have been cache hits — 2,000/day on the category page (cookie client via four helpers, one aliased as `createAnonClient`), 660 OG renders, a calculator with a dead `revalidate`, and 233 empty blog hubs rendered per crawl.
