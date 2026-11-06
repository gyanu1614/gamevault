/**
 * A public read that fails must throw, so the page keeps its last good copy.
 *
 * createAnonClient throws by itself (src/lib/supabase/failed-read.ts). What this
 * pins is the way up: on 2026-11-05 the Supabase block turned into saved 404s and
 * empty lists because readers caught the failure, or used a client that returns
 * it as `data: null`. `pnpm build` runs the same check, so a new one fails the
 * deploy. Pure source analysis: no DB, no Next runtime.
 */
import { describe, expect, it } from 'vitest'

import {
  checkFailedReads,
  publicServerModules,
  staleReadFailureExemptions,
  swallowingCatches,
} from '../../../scripts/check-public-route-caching.mjs'

describe('public read failures', () => {
  it('walks the real public graph (guards a vacuous pass)', () => {
    const modules = publicServerModules()
    expect(modules.length).toBeGreaterThan(200)
    expect(modules).toContain('src/lib/value-listings/stock-server.ts')
    expect(modules).toContain('src/lib/seo/category-pairs.ts')
    expect(modules).toContain('src/app/sitemaps/[file]/route.ts')
    expect(modules).not.toContain('src/lib/supabase/failed-read.test.ts')
  })

  it('no public read path can hide a failure', () => {
    const problems = checkFailedReads()
    expect(problems, problems.join('\n')).toEqual([])
  })

  it('every exemption still does something', () => {
    const stale = staleReadFailureExemptions()
    expect(stale, stale.join('\n')).toEqual([])
  })
})

describe('swallowingCatches', () => {
  it('counts a catch that hands back a fallback', () => {
    expect(swallowingCatches('try { a() } catch { return [] }')).toBe(1)
    expect(swallowingCatches('try { a() } catch (e) { console.error(e); return null }')).toBe(1)
    expect(swallowingCatches('await a().catch(() => [])')).toBe(1)
  })

  it('passes a catch that lets a failed read through', () => {
    expect(swallowingCatches('try { a() } catch (e) { rethrowFailedRead(e); return [] }')).toBe(0)
    expect(swallowingCatches('await a().catch((e) => { rethrowFailedRead(e); return [] })')).toBe(0)
    expect(swallowingCatches('try { a() } catch (e) { throw new Error(String(e)) }')).toBe(0)
  })

  it('ignores a comment that mentions catch', () => {
    expect(swallowingCatches('// a catch { here }\n/* and .catch( here */ const a = 1')).toBe(0)
  })
})
