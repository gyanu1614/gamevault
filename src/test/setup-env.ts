/**
 * Vitest setup: choose the test environment file.
 *
 * DEFAULT: `.env.test` — a local Supabase stack, no RESEND_API_KEY, no live
 * provider credentials. Copy it from `.env.test.example`.
 *
 * OPT-IN: `ALLOW_REMOTE_GUARD_TESTS=1` loads `.env.local` instead, which is
 * the developer's real environment (production Supabase, live keys). Only the
 * guard/integration suites that deliberately need a remote target should ever
 * be run that way, and they say so in their own error messages.
 *
 * WHY. Until 2026-09-12 this file loaded `.env.local` unconditionally, so
 * every `vitest run` held production credentials. A webhook integration test
 * inserted a real order against production, drove the real dispatch chain, and
 * emailed live sellers ("You made a sale — … #TEST-WH-…"); 32 orphaned
 * notifications accumulated on real accounts over about two months before
 * anyone noticed. Reaching production from a test is now an explicit,
 * one-variable decision rather than the default.
 *
 * Unit tests (money/ids/errors/the pure ledger seam) need no env at all, and
 * integration tests self-skip when their vars are absent — so a machine with
 * neither file still runs the suite green.
 */
import { existsSync } from 'node:fs'

import { config } from 'dotenv'

const useLocalEnv = process.env.ALLOW_REMOTE_GUARD_TESTS === '1'
const envFile = useLocalEnv ? '.env.local' : '.env.test'

if (existsSync(envFile)) {
  config({ path: envFile })
} else if (!useLocalEnv) {
  // Not fatal: unit tests need nothing, integration tests self-skip. But say
  // so, because "my integration tests all skip" is otherwise a puzzle.
  // eslint-disable-next-line no-console
  console.warn(
    `[test env] ${envFile} not found — integration tests will self-skip. ` +
      'Create it with: cp .env.test.example .env.test (then npx supabase start).',
  )
}
