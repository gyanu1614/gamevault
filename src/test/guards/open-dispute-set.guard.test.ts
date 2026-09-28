/**
 * Open-dispute counts use OPEN_DISPUTE_STATUSES (src/lib/admin/status-sets.ts),
 * never a hand-written partial list.
 *
 * Until 2026-09-27 the admin dashboard, analytics, seller-review stats and the
 * admin header's queue badge each counted `['open', 'under_review']` — every
 * dispute waiting on a party (awaiting_seller_response /
 * awaiting_buyer_response) or escalated was missing from "Open disputes".
 * The server numbers are pinned against SQL in
 * admin-dashboard-numbers.guard.integration.test.ts; this catches the literal
 * anywhere else, including client components that test cannot reach.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(process.cwd(), 'src')

/** An array literal that starts 'open', 'under_review' and stops there. */
const PARTIAL_OPEN_SET = /\[\s*(['"])open\1\s*,\s*(['"])under_review\2\s*\]/

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules') continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

describe('open-dispute counts use the shared set', () => {
  it('the pattern catches the old literal', () => {
    expect(PARTIAL_OPEN_SET.test(".in('status', ['open', 'under_review'])")).toBe(true)
    expect(PARTIAL_OPEN_SET.test(".in('status', OPEN_DISPUTE_STATUSES)")).toBe(false)
  })

  it('no source file counts open disputes with a partial list', () => {
    const offenders = walk(ROOT)
      .filter((p) => PARTIAL_OPEN_SET.test(readFileSync(p, 'utf8')))
      .map((p) => relative(process.cwd(), p))
    expect(offenders).toEqual([])
  })
})
