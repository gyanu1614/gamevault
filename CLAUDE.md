# DropMarket

## Skill usage (apply automatically, never ask)
- UI/component work → design-taste-frontend (primary) + frontend-design; apple-design for motion, gestures, touch feel; ui-ux-pro-max only for palette/font choices; review with web-design-guidelines before finishing
- Any React/Next code → vercel-react-best-practices
- Unsure about a library API → context7 first, never guess
- New feature or bug → superpowers (brainstorm → plan → TDD → verify)
- Payment, auth, or user-data code → security-guidance must pass before finishing
- Pages, metadata, listings → seo (router) and its sub-skills
- Be concise. Prefer grep/glob over reading whole files. Show evidence, not claims.

## Tests & environment (never bypass)
- `vitest` loads **`.env.test`** by default: local Supabase, **no `RESEND_API_KEY`**, dummy provider keys. Set it up once: `cp .env.test.example .env.test` then `npx supabase start`.
- `.env.test` is gitignored; **`.env.test.example` is committed**. Never put a real secret in either.
- `ALLOW_REMOTE_GUARD_TESTS=1` is the ONLY way to load `.env.local` (production Supabase + live keys) into a test run. Use it deliberately, never to "make a failing test pass".
- A test that touches email **must** `vi.mock('@/lib/email')`. Real sends throw from a test run (`src/lib/email/transport-guard.ts`).
- Integration tests that create rows must call `assertGuardTargetAllowed` before writing, and must clean up **every** row they cause — including rows written by side effects (notifications, ledger), not just the ones they insert directly.
- Why: on 2026-09-12 a plain `vitest run` emailed real sellers and left 32 orphaned notifications on production accounts for ~2 months. `setup-env.ts` had loaded `.env.local` unconditionally.

## Database functions & grants (from migration 20260913100000)
- New SQL functions in `public` are **service-role-only by default** (the default `EXECUTE` grant to anon/authenticated is revoked). A function the browser or a session client must call needs an explicit `GRANT EXECUTE ON FUNCTION … TO authenticated` (or `anon`) in its migration **and** an entry in the allow-list in `src/test/guards/db-p0-grants.guard.integration.test.ts` — the posture test fails otherwise.
- Every `SECURITY DEFINER` function pins `SET search_path = public`. Views are created `WITH (security_invoker = true)`.
- Cron/admin routes must call RPCs through `createServiceRoleClient()`; the session client has no cookies on a Vercel cron request and runs as anon.
- Why: on 2026-09-11 the audit found 39 definer functions and 10 views open to the anon key (tax ids, delivery codes, order state) because the baseline granted `EXECUTE` by default.

## Money seams are single SQL functions (from migration 20260914100000)
- Order cancel + wallet-hold return, order refund + wallet credit, withdrawal cancel/reject, inventory claim, promo usage: each is ONE service-role RPC (`order_cancel_return_wallet`, `order_refund_to_wallet`, `withdrawal_cancel`, `withdrawal_reject`, `inventory_claim_for_order`, `promo_usage_record`). Never re-compose these as two calls from TypeScript; call the RPC (TS seam: `src/lib/wallet/order-money.ts`).
- `money_fault_hook(point)` exists ONLY for tests: it raises when the transaction-local GUC `app.money_fault` equals `point`. PostgREST callers cannot set that GUC, so it is inert in the app; the GREEN tests set it from a psql transaction (`src/test/guards/money-atomicity.guard.integration.test.ts`, `withFault`) to prove a failure inside an atomic function leaves no partial state. Keep every new money function's interior steps behind a `PERFORM money_fault_hook('<fn>:<point>')` so the same proof can be written for it.
- A `failed` webhook event is re-claimed by `webhook_event_claim` on the provider's retry; there is no replay worker. A dispatch failure must throw (router → 500), never be swallowed.
- Why: on 2026-09-11 the audit (DB-015/016/017) found every money seam composed two atomic RPCs with no compensation; reproduced on the local stack 2026-09-14: stranded wallet holds, lost refund credits, "Funds stay in your wallet" on a paid-out hold, one code sold to two buyers.
