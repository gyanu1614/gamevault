/**
 * supabase/migrations_pending/ — the holding area for migrations that are
 * finished but must not be applied yet.
 *
 * Why it exists: `supabase db push` applies EVERY pending file in
 * supabase/migrations/ in one go — there is no way to push a subset. So a
 * migration that must land after a specific deploy cannot sit in migrations/
 * at all, or it rides along with the next push. DLT-001 is split exactly this
 * way: PART A (create the view) must land BEFORE the code that reads it, PART
 * B (revoke anon) must land AFTER. One directory cannot express that order.
 *
 * The failure mode this guard exists for is a pending migration that is simply
 * FORGOTTEN — DLT-001 would then sit permanently half-fixed, with the view in
 * place and the anon hole still open, and nothing would be red. Two cheap
 * static checks make that loud:
 *
 *   1. every pending file says it is not live and names how it ships, so the
 *      next person reading it cannot mistake it for an applied migration;
 *   2. a pending file is never ALSO in migrations/ under the same name, which
 *      is what a botched "move" (copy instead of git mv) looks like — and
 *      would apply it early, silently.
 *
 * This is a static read of the repo; no database required.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const PENDING = join(process.cwd(), 'supabase', 'migrations_pending')
const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

function pendingSqlFiles(): string[] {
  if (!existsSync(PENDING)) return []
  return readdirSync(PENDING).filter((f) => f.endsWith('.sql')).sort()
}

describe('supabase/migrations_pending — held-back migrations stay held back', () => {
  it('the directory documents itself', () => {
    if (!existsSync(PENDING)) return
    expect(
      existsSync(join(PENDING, 'README.md')),
      'supabase/migrations_pending/ has no README.md explaining why files are held and how they ship',
    ).toBe(true)
  })

  it.each(pendingSqlFiles())('%s is marked as not-yet-live', (file) => {
    const sql = readFileSync(join(PENDING, file), 'utf8')
    expect(
      /NOT A LIVE MIGRATION/i.test(sql),
      `${file} does not carry a "NOT A LIVE MIGRATION" marker — someone could mistake it for applied`,
    ).toBe(true)
    expect(
      /migrations_pending/.test(sql),
      `${file} does not explain that it lives in migrations_pending/ and why`,
    ).toBe(true)
  })

  it.each(pendingSqlFiles())('%s is not also present in migrations/ (a copy, not a move)', (file) => {
    expect(
      existsSync(join(MIGRATIONS, file)),
      `${file} exists in BOTH migrations_pending/ and migrations/. If it is ready, delete the ` +
        'pending copy; if it is not, remove it from migrations/ — otherwise the next db push ' +
        'applies it early.',
    ).toBe(false)
  })

  /**
   * Ordering: a held-back file must still sort after everything already in
   * migrations/, or moving it later would place it BEFORE migrations that have
   * already run — the silent-skip trap from CLAUDE.md (the Supabase CLI
   * compares version numbers only, so an out-of-order file is never applied).
   */
  it.each(pendingSqlFiles())('%s still sorts after every applied migration', (file) => {
    const version = file.slice(0, 14)
    const latestApplied = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.slice(0, 14))
      .sort()
      .pop()
    expect(
      version > (latestApplied ?? ''),
      `${file} (${version}) sorts at or before the newest migration in migrations/ ` +
        `(${latestApplied}). Moving it would make the CLI skip it silently — rename it to a ` +
        'later real-second timestamp before shipping.',
    ).toBe(true)
  })
})
