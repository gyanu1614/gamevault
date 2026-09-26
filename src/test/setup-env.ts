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
      'Create it with: pnpm db:up (starts this worktree\'s stack and writes .env.test).',
  )
}

/**
 * The psql-based suites (fault injection, audit_logs purge) read
 * SUPABASE_DB_URL and used to fall back to 127.0.0.1:54322 — the MAIN
 * checkout's stack. With per-worktree stacks (scripts/local-stack.mjs) that
 * fallback would point a worktree's psql at another worktree's database while
 * its PostgREST calls hit its own. `pnpm db:up` writes SUPABASE_DB_URL; for an
 * older .env.test without it, derive it from the local API URL: every stack's
 * db port is its api port + 1 (54321/54322 on main).
 */
if (!process.env.SUPABASE_DB_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
    if (['127.0.0.1', 'localhost'].includes(api.hostname) && api.port) {
      process.env.SUPABASE_DB_URL = `postgresql://postgres:postgres@127.0.0.1:${Number(api.port) + 1}/postgres`
    }
  } catch {
    // unparsable URL: leave it; the suites' own guards reject it
  }
}
