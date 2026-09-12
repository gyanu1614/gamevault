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
