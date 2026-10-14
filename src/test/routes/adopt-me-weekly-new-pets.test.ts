import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const wf = readFileSync(join(process.cwd(), '.github/workflows/adopt-me-weekly-catalog.yml'), 'utf8')

/**
 * Bug (2026-10-14): the weekly catalog job never added a new pet (Jester
 * Dragon, released Oct 3, was missing). import-adoptmevalues holds back every
 * slug not already in the DB unless it gets --allow-new or --qualifying; the
 * job passed neither. Owner rule (values-tasks T2): list a pet only when a
 * variant has a real reputable price above $1 — exactly the dry run's
 * `qualifies`. So the job runs the dry run first and imports with its report.
 */
describe('Adopt Me weekly catalog: new pets', () => {
  it('runs the qualifying dry run before the import', () => {
    expect(wf.indexOf('pnpm adoptme:catalog:dryrun')).toBeGreaterThan(-1)
    expect(wf.indexOf('pnpm adoptme:catalog:dryrun')).toBeLessThan(wf.indexOf('pnpm adoptme:catalog --qualifying'))
  })

  it('imports new pets only through the dry run report (never --allow-new)', () => {
    expect(wf).toMatch(/pnpm adoptme:catalog --qualifying "\$REPORT"/)
    expect(wf).not.toContain('--allow-new')
  })

  it('gives the dry run the public read key it uses', () => {
    expect(wf).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY:\s*\$\{\{\s*secrets\.NEXT_PUBLIC_SUPABASE_ANON_KEY\s*\}\}/)
  })
})
