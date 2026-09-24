/**
 * Per-test-file fixture namespaces.
 *
 * Every guard fixture used to be `guardtest-<label>-<random>@example.com` /
 * `GUARD-TEST-<random>`, and the teardown residue check matched the WHOLE
 * pattern. So one suite's leak (or a second worktree running against the same
 * stack) failed every other suite's teardown, and nobody could tell whose
 * rows they were. Now each test file owns a stable 4-char key derived from
 * its repo-relative path; every id it mints embeds that key, its residue
 * check looks only at its own key, and its purge deletes only its own rows —
 * including stale rows a crashed earlier run of the SAME file left behind.
 *
 *   guardtest-seller-<fileKey><run>@example.com     (GUARD_EMAIL_RE-compatible)
 *   GUARD-TEST-<fileKey><run>                       (listing titles)
 *   guard-test-<fileKey><run>                       (throwaway game slugs)
 *
 * audit_logs is immutable (trg_prevent_audit_log_delete) and its user FK is
 * ON DELETE SET NULL, so a fixture user with audit rows cannot be deleted
 * through PostgREST. `purgeAuditLogs` uses the psql path the checkout suites
 * already used: disable the trigger inside one transaction, delete, re-enable
 * — on a LOCAL stack only.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'

import { expect } from 'vitest'

/** 32-bit FNV-1a (same as scripts/lib/local-stack.mjs). */
function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Stable 4-char [a-z0-9] key for a test file, from its REPO-RELATIVE path —
 * the same in every worktree, and distinct for same-named files in different
 * folders (two `steal-an-egg.test.ts` exist).
 */
export function fileKey(testFile: string): string {
  const rel = path.isAbsolute(testFile) ? path.relative(process.cwd(), testFile) : path.normalize(testFile)
  return fnv1a(rel.split(path.sep).join('/')).toString(36).padStart(4, '0').slice(-4)
}

/** The test file vitest is running right now. */
export function currentTestFile(): string {
  const p = expect.getState().testPath
  if (!p) throw new Error('fixture namespace: no current test file — call from inside a vitest file (beforeAll/it)')
  return p
}

export type FixtureNamespace = {
  /** file key — the scope of residue checks and purges */
  key: string
  /** key + per-run suffix — what a fixture embeds in the ids it mints */
  tag: string
  file: string
  email: (label: string) => string
  username: (label: string) => string
  listingTitle: () => string
  /** LIKE patterns matching every row ANY run of this file can create */
  emailLike: string
  emailRe: RegExp
  listingLike: string
  gameSlugLike: string
}

export function fixtureNamespace(testFile: string = currentTestFile()): FixtureNamespace {
  const key = fileKey(testFile)
  const run = Math.random().toString(36).slice(2, 5).padEnd(3, '0')
  const tag = `${key}${run}`
  return {
    key,
    tag,
    file: path.basename(testFile),
    email: (label) => `guardtest-${label}-${tag}@example.com`,
    // profiles.username CHECK: 3..30 chars
    username: (label) => `gt_${label}_${tag}`.slice(0, 30),
    listingTitle: () => `GUARD-TEST-${tag}`,
    emailLike: `guardtest-%-${key}%@example.com`,
    emailRe: new RegExp(`^guardtest-[a-z]+-${key}[a-z0-9]*@example\\.com$`),
    listingLike: `GUARD-TEST-${key}%`,
    gameSlugLike: `guard-test-${key}%`,
  }
}

/** The local stack's direct Postgres URL (setup-env derives it when .env.test predates it). */
export function testDbUrl(): string {
  return process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
}

/** Only a loopback Supabase URL may have its audit trail rewritten. */
export function targetIsLocal(url = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  try {
    const host = new globalThis.URL(url ?? '').hostname
    return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1'
  } catch {
    return false
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Delete audit_logs rows written by `userIds` — local stack only, through the
 * psql path (the delete trigger stays disabled for this one transaction).
 * Failures are pushed onto `failures`, never swallowed. Remote: no-op (the
 * audit trail there is never rewritten by a test).
 */
export function purgeAuditLogs(userIds: string[], failures: string[]): void {
  const ids = userIds.filter((id) => UUID_RE.test(id))
  if (!ids.length || !targetIsLocal()) return
  try {
    execFileSync('psql', [testDbUrl(), '-X', '-v', 'ON_ERROR_STOP=1', '-q', '-c',
      `BEGIN; ALTER TABLE public.audit_logs DISABLE TRIGGER trg_prevent_audit_log_delete; ` +
      `DELETE FROM public.audit_logs WHERE user_id IN ('${ids.join("','")}'); ` +
      `ALTER TABLE public.audit_logs ENABLE TRIGGER trg_prevent_audit_log_delete; COMMIT;`], { stdio: 'pipe' })
  } catch (e: any) {
    failures.push(`audit_logs purge: ${e?.stderr?.toString() ?? e}`)
  }
}
