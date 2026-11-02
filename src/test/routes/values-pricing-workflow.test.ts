/**
 * values-pricing-daily.yml — the one daily pricing window (T1, 2026-10-04).
 *
 * Static lint (no YAML dependency in the repo; actionlint is not installed):
 * the file is split into its top-level jobs by indentation and each job's
 * text is checked for the properties a bad edit would silently lose — the
 * publish step, the freshness guard, independence between games, timeouts.
 * Parsed with a real YAML parser when written (PyYAML 6, 2026-10-04).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const FILE = '.github/workflows/values-pricing-daily.yml'
const raw = readFileSync(FILE, 'utf8')
/** Full-line comments removed: the checks are about what runs, not prose. */
const yml = raw
  .split('\n')
  .filter((line) => !/^\s*#/.test(line))
  .join('\n')

/** Top-level job name → that job's text (2-space-indented keys under `jobs:`). */
function jobs(source: string): Record<string, string> {
  const body = source.slice(source.indexOf('\njobs:\n') + '\njobs:\n'.length)
  const out: Record<string, string> = {}
  let current: string | null = null
  for (const line of body.split('\n')) {
    const m = line.match(/^ {2}([a-z0-9-]+):\s*$/)
    if (m) {
      current = m[1]
      out[current] = ''
    } else if (current) out[current] += `${line}\n`
  }
  return out
}

const J = jobs(yml)

/** The `- name:` step block containing `needle`, or '' (up to the next step). */
function stepWith(job: string, needle: string): string {
  return job.split(/\n(?= {6}- )/).find((s) => s.includes(needle)) ?? ''
}

describe('values-pricing-daily.yml', () => {
  it('is well-formed enough to load: no tabs, balanced expressions, quoted "off"', () => {
    expect(raw.includes('\t')).toBe(false)
    expect(raw.split('${{').length).toBe(raw.split('}}').length)
    // YAML 1.1 reads a bare off as boolean false — the choice option must be quoted.
    expect(yml).toMatch(/options: \[changed, full, "off"\]/)
  })

  it('runs once a day, never two windows at once', () => {
    expect([...yml.matchAll(/- cron: "([^"]+)"/g)].map((m) => m[1])).toEqual(['10 2 * * *'])
    expect(yml).toMatch(/concurrency:\n {2}group: values-pricing-daily\n {2}cancel-in-progress: false/)
  })

  it('has one job per game (SAB split into its two sources)', () => {
    expect(Object.keys(J).sort()).toEqual(['adopt-me', 'alert', 'murder-mystery-2', 'sab', 'sab-g2g', 'steal-an-egg'])
    for (const [name, text] of Object.entries(J)) {
      expect(text, `${name} needs a timeout`).toMatch(/timeout-minutes: \d+/)
    }
  })

  it("games are independent: one game's failure never blocks another", () => {
    // Adopt Me waits for SAB (both hammer the same database; its import and
    // reprice overlapping SAB's publish timed SAB out daily, 2026-10-07/09)
    // but runs whatever SAB's outcome.
    expect(J['adopt-me']).toMatch(/(^|\n) {4}needs: sab\n/)
    expect(J['adopt-me']).toMatch(/always\(\)/)
    // One Eldorado crawl at a time (2026-10-29: Eldorado throttled SAB two
    // days running): steal-an-egg → murder-mystery-2 → sab → adopt-me, each
    // running whatever the previous one's outcome.
    expect(J['steal-an-egg']).not.toMatch(/\n {4}needs:/)
    expect(J['murder-mystery-2']).toMatch(/(^|\n) {4}needs: steal-an-egg\n/)
    expect(J['murder-mystery-2']).toMatch(/always\(\)/)
    // SAB waits for its own G2G cross-check and for MM2, but runs even when they failed.
    expect(J.sab).toMatch(/(^|\n) {4}needs: \[sab-g2g, murder-mystery-2\]\n/)
    expect(J.sab).toMatch(/always\(\)/)
  })

  it("serialising the Eldorado crawls does not lengthen the worst case", () => {
    // steal-an-egg → murder-mystery-2 runs beside sab-g2g; both lead into sab.
    // As long as the chain fits in sab-g2g's timeout, the window's worst case
    // stays sab-g2g → sab → adopt-me (src/test/routes/db-heavy-schedule.test.ts).
    const timeout = (job: string) => Number(J[job].match(/timeout-minutes: (\d+)/)?.[1])
    expect(timeout('steal-an-egg') + timeout('murder-mystery-2')).toBeLessThanOrEqual(timeout('sab-g2g'))
  })

  it('a throttled SAB crawl stops inside its job and is still reported', () => {
    // The crawl's own budget leaves room for import (≤20 min lock wait + ~3),
    // popularity, expire, reprice and freshness inside the job timeout.
    const step = stepWith(J.sab, 'pnpm sab:eldorado:send')
    const budget = Number(step.match(/--max-crawl-minutes (\d+)/)?.[1])
    const timeout = Number(J.sab.match(/timeout-minutes: (\d+)/)?.[1])
    expect(budget).toBeGreaterThan(0)
    expect(budget + 40).toBeLessThanOrEqual(timeout)
    expect(step).toMatch(/--request-interval-ms \d+/)
    expect(step).toMatch(/\bid: eldorado\b/)
    // The crawl's stopped_early output → a job output → the alert job's 🟡 post.
    expect(J.sab).toContain('eldorado_stopped_early: ${{ steps.eldorado.outputs.stopped_early }}')
    expect(J.alert).toContain("needs.sab.outputs.eldorado_stopped_early != ''")
    expect(J.alert).toContain('SAB_STOPPED_EARLY: ${{ needs.sab.outputs.eldorado_stopped_early }}')
  })

  it('every game ends in the shared publish step, which may not be skipped on error', () => {
    expect(yml).toMatch(/PUBLISH_FLAG: .*'--publish'/)
    for (const [job, key] of [
      ['sab', 'sab'],
      ['adopt-me', 'adopt-me'],
      ['steal-an-egg', 'steal-an-egg'],
    ]) {
      const step = stepWith(J[job], `pnpm reprice --game=${key}`)
      expect(step, `${job}: reprice step`).not.toBe('')
      expect(step).toContain('env.PUBLISH_FLAG')
      expect(step).not.toContain('continue-on-error')
      expect(J[job], `${job}: publish needs the route secret`).toContain(
        'VALUES_REVALIDATE_SECRET: ${{ secrets.VALUES_REVALIDATE_SECRET }}',
      )
      expect(J[job]).toContain('PUBLIC_API_URL: ${{ secrets.PUBLIC_API_URL }}')
    }
  })

  it('no step curls the whole-game revalidation any more', () => {
    expect(yml).not.toContain('/api/internal/values-revalidate')
  })

  it('SAB keeps its lifecycle + freshness guard (ROUTE-014), hard-failing', () => {
    const expire = stepWith(J.sab, 'pnpm sab:expire')
    expect(expire).not.toContain('continue-on-error')
    const fresh = stepWith(J.sab, '/api/cron/check-sab-freshness')
    expect(fresh).not.toBe('')
    expect(fresh).not.toContain('continue-on-error')
    // Freshness runs after the reprice, against the state this run produced.
    expect(J.sab.indexOf('/api/cron/check-sab-freshness')).toBeGreaterThan(
      J.sab.indexOf('pnpm reprice --game=sab'),
    )
    // The recovery artifact name is load-bearing (publish-only downloads it).
    expect(J.sab).toContain('name: eldorado-sab-market-${{ github.run_id }}')
  })

  it('Adopt Me: one category crawl, 90 min budget, no u7buy', () => {
    expect(J['adopt-me']).toContain('pnpm adoptme:cash:eldorado:crawl')
    expect(J['adopt-me']).not.toContain('u7buy')
    expect(J['adopt-me']).toMatch(/timeout-minutes: 90/)
  })

  it('the package scripts it calls exist', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
    for (const script of [...yml.matchAll(/pnpm ([a-z][a-z0-9:-]+)/g)].map((m) => m[1])) {
      if (script === 'install') continue
      expect(pkg.scripts, `package.json is missing "${script}"`).toHaveProperty(script)
    }
  })
})
