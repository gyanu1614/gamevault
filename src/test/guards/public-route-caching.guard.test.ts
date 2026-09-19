/**
 * Phase 1 · Step 7a — public pages are static-first.
 *
 * The Vercel CPU audit (2026-09-18) found ~13 min/day of Fluid Active CPU
 * going to page renders that should have been cache hits: the category page
 * pulled the cookie client through four helpers (one aliased as
 * `createAnonClient`), the calculator read `searchParams` next to a dead
 * `revalidate`, and the hub routes answered 233 games with an on-demand render
 * apiece. Each of those is a one-line slip that the type checker cannot see.
 *
 * `scripts/check-public-route-caching.mjs` encodes the rules (R1–R5, see the
 * file header) and `pnpm build` runs it ahead of `next build`. This test runs
 * the same function so `pnpm test` fails on the same slip, with the offending
 * import edge in the message. Pure source analysis — no DB, no Next runtime.
 */
import { describe, it, expect } from 'vitest'
import {
  checkAll,
  staleGrandfathers,
  GRANDFATHERED,
  MIXED_ACTION_MODULES,
} from '../../../scripts/check-public-route-caching.mjs'

const results = checkAll()

describe('public-route caching guard', () => {
  it('scans the public routes (guards a vacuous pass)', () => {
    expect(results.length).toBeGreaterThan(20)
    expect(results.map((r) => r.route)).toContain('(marketplace)/[gameSlug]/[categorySlug]')
  })

  it('no public route breaks a caching rule', () => {
    const failing = results
      .filter((r) => r.violations.length)
      .map((r) => `${r.route}\n${r.violations.map((v) => `    ${v.rule}: ${v.detail}`).join('\n')}`)
    expect(failing, failing.join('\n\n')).toEqual([])
  })

  it('every grandfather entry still fires (a fixed route must be removed from the list)', () => {
    expect(staleGrandfathers(results)).toEqual([])
  })

  it('the grandfather and mixed-module lists only shrink without review', () => {
    // Pinned so a PR that adds a per-request public route or a new mixed
    // action module shows the change here, in the review, not in the CPU bill.
    expect(Object.keys(GRANDFATHERED).sort()).toEqual([
      '(marketplace)/[gameSlug]/[categorySlug]/[listingSlug]',
      'buy/[seoSlug]',
      'listings/[id]',
    ])
    expect([...MIXED_ACTION_MODULES].sort()).toEqual([
      'src/lib/actions/admin-category-configs.ts',
      'src/lib/actions/new-schema.ts',
      'src/lib/actions/seller-presence.ts',
    ])
  })
})
