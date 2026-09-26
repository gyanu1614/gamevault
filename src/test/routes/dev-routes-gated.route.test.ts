/**
 * ROUTE-002 — internal-only routes must not be reachable on the live site.
 *
 * Eight non-production routes returned 200 in production: the /test stub and
 * seven /dev/* design previews. robots.ts disallowed them, but robots.txt is
 * advisory — it stops indexing, not reachability, and these pages render real
 * product chrome with no metadata and no auth.
 *
 * /test was a bare "Next.js is working!" stub with no referrers and was
 * deleted. The /dev/* previews are live design tools (referenced by
 * layout-wrapper.tsx and beta-banner.tsx), so they are kept and gated by a
 * server-side layout instead — three of them are client components and could
 * not call notFound() themselves.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

import { isProductionDeployment } from '@/lib/env/deployment'

// Snapshot only the two vars under test and restore them in place. Replacing
// the whole `process.env` object (process.env = {...}) breaks the live binding
// that already-imported modules hold, so the predicate under test would read a
// detached copy.
const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV
const ORIGINAL_NODE_ENV = process.env.NODE_ENV

// process.env.NODE_ENV is typed readonly, so go through a widened alias to
// set and clear both vars uniformly.
const env = process.env as Record<string, string | undefined>

afterEach(() => {
  setEnv(ORIGINAL_VERCEL_ENV, ORIGINAL_NODE_ENV)
})

const setEnv = (vercel?: string, node?: string) => {
  if (vercel === undefined) delete env.VERCEL_ENV
  else env.VERCEL_ENV = vercel
  if (node === undefined) delete env.NODE_ENV
  else env.NODE_ENV = node
}

describe('ROUTE-002 — the /test stub is gone', () => {
  it('has no route directory', () => {
    expect(existsSync('src/app/test')).toBe(false)
  })

  it('is no longer disallowed in robots.ts (nothing left to hide)', () => {
    const robots = readFileSync('src/app/robots.ts', 'utf8')
    expect(robots).not.toMatch(/'\/test'/)
  })
})

describe('ROUTE-002 — /dev/* is gated server-side', () => {
  it('ships a layout that runs the guard', () => {
    const layout = readFileSync('src/app/dev/layout.tsx', 'utf8')
    expect(layout).toMatch(/devOnlyRoute\(\)/)
  })

  it('gates every /dev/* page through that one layout', () => {
    // The layout is the single seam; assert the previews still exist so this
    // test fails loudly if they move out from under it rather than passing
    // vacuously.
    const pages = readdirSync('src/app/dev', { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .filter((e) => existsSync(`src/app/dev/${e.name}/page.tsx`))
    expect(pages.length).toBeGreaterThan(0)
  })

  it('keeps the /dev/ robots disallow for preview deployments', () => {
    expect(readFileSync('src/app/robots.ts', 'utf8')).toMatch(/'\/dev\/'/)
  })
})

describe('ROUTE-002 — isProductionDeployment predicate', () => {
  it('is production on Vercel production', () => {
    setEnv('production', 'production')
    expect(isProductionDeployment()).toBe(true)
  })

  it('is NOT production on a Vercel preview deployment', () => {
    // Preview builds run with NODE_ENV=production but are not the live site.
    setEnv('preview', 'production')
    expect(isProductionDeployment()).toBe(false)
  })

  it('is NOT production in local dev', () => {
    setEnv(undefined, 'development')
    expect(isProductionDeployment()).toBe(false)
  })

  it('is production on a non-Vercel production host', () => {
    setEnv(undefined, 'production')
    expect(isProductionDeployment()).toBe(true)
  })
})
