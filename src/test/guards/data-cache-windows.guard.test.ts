/**
 * Guard: shared data caches refresh daily or slower (2026-10-20 usage audit, A2).
 *
 * In Next 14 a page's ISR window becomes the SHORTEST `revalidate` of any
 * unstable_cache / tagged fetch it reads (unstable-cache.js lowers the
 * render's revalidate to the entry's own). The footer renders on every page
 * and read the test-seller ids with `revalidate: 3600`, so 2,076 of 2,391
 * prerendered pages rebuilt hourly — value pages that declare a week, legal
 * pages that fetch nothing else — each rebuild re-reading Supabase.
 *
 * Freshness comes from events (revalidateTag on the mutation that changes the
 * data), so a cache window is only a backstop and must be at least a day.
 * Shorter windows are allowed only on private surfaces, listed with a reason.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const DAY = 86_400

/** file → why a sub-day window is fine there. */
const SUB_DAY_ALLOWED: Record<string, string> = {
  'src/lib/sell/template-read.ts': 'sell wizard templates: a signed-in seller surface, never a public page',
  'src/lib/price-helper/server.ts': 'market price hint for the sell form (server action), never a public page',
}

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

/** Every `revalidate: <seconds>` option (unstable_cache, tagged clients, fetch next). */
function windows(): { file: string; line: number; seconds: number }[] {
  const found: { file: string; line: number; seconds: number }[] = []
  for (const full of [...sourceFiles(join(ROOT, 'src/lib')), ...sourceFiles(join(ROOT, 'src/app')), ...sourceFiles(join(ROOT, 'src/components'))]) {
    const file = relative(ROOT, full)
    readFileSync(full, 'utf8')
      .split('\n')
      .forEach((text, i) => {
        const m = /\brevalidate:\s*([0-9_]+(?:\s*\*\s*[0-9_]+)*)/.exec(text)
        if (!m) return
        // eslint-disable-next-line no-new-func -- the matched text is digits, _ and * only
        const seconds = Function(`return (${m[1].replace(/_/g, '')})`)() as number
        found.push({ file, line: i + 1, seconds })
      })
  }
  return found
}

describe('data cache windows', () => {
  const all = windows()

  it('finds the cache options (guards the scan itself)', () => {
    expect(all.length).toBeGreaterThan(15)
  })

  it('no shared data cache refreshes more often than daily outside the private allow-list', () => {
    const offenders = all
      .filter((w) => w.seconds < DAY && !(w.file in SUB_DAY_ALLOWED))
      .map((w) => `${w.file}:${w.line} (${w.seconds}s)`)
    expect(offenders).toEqual([])
  })
})
