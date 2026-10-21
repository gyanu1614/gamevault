/**
 * Direct psql against THIS worktree's local stack, for SQL behaviour tests.
 *
 * Every script runs in one transaction that always rolls back, so a test
 * leaves no rows behind (no fixtures, no side-effect rows to purge). Only the
 * local stack offers a direct session: against any other host the suites that
 * use this skip (`describe.skipIf(!DB_IS_LOCAL)`).
 */
import { execFileSync } from 'node:child_process'

export const DB_URL = process.env.SUPABASE_DB_URL ?? ''

const host = (() => {
  try {
    return new globalThis.URL(DB_URL).hostname
  } catch {
    return ''
  }
})()

export const DB_IS_LOCAL = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)

/** Runs the statements in one transaction that always rolls back. Each
 *  row a `select` prints is one `|`-separated line. */
export function runRolledBack(statements: string[]): string[] {
  if (!DB_IS_LOCAL) throw new Error(`runRolledBack: refusing a non-local database (${host || 'unset'})`)
  const script = ['BEGIN;', ...statements.map((s) => `${s};`), 'ROLLBACK;'].join('\n')
  try {
    const out = execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-At', '-F', '|', '-c', script], {
      stdio: 'pipe',
    })
    return out.toString().trim().split('\n').filter(Boolean)
  } catch (e) {
    // Surface psql's own message (the SQL error), not the command line.
    const stderr = (e as { stderr?: Buffer }).stderr?.toString().trim()
    throw new Error(stderr || String(e))
  }
}

/** A SQL string literal (single quotes doubled). */
export const sqlText = (s: string) => `'${s.replace(/'/g, "''")}'`
