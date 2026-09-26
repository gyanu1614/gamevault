/**
 * AUTH-001 — the public storefront must never serialize sensitive profile /
 * review columns to anonymous visitors.
 *
 *  1. Allowlist ∩ sensitive = ∅ and allowlist ⊇ what SellerStorefront renders.
 *  2. Source guard: the page never `select('*')`s profiles/reviews, uses the
 *     allowlist constants, and filters every reviews query on is_visible.
 *  3. Integration (self-skips without env): run the exact select the page runs,
 *     as service role, and assert the returned keys ⊆ allowlist.
 */
import { describe, it, expect } from 'vitest'

import { supabaseReachable } from '@/test/supabase-reachable'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  PUBLIC_SELLER_PROFILE_COLUMNS,
  PUBLIC_SELLER_PROFILE_SELECT,
  PUBLIC_REVIEW_COLUMNS,
  PUBLIC_REVIEW_SELECT,
  SENSITIVE_PROFILE_COLUMNS,
  SENSITIVE_REVIEW_COLUMNS,
} from './public-profile'

const PAGE = readFileSync('src/app/shop/[slug]/page.tsx', 'utf8')
const STOREFRONT = readFileSync('src/components/shop/SellerStorefront.tsx', 'utf8')

describe('AUTH-001 — public storefront allowlist', () => {
  it('profile allowlist contains no sensitive column', () => {
    const leaked = SENSITIVE_PROFILE_COLUMNS.filter((c) =>
      (PUBLIC_SELLER_PROFILE_COLUMNS as readonly string[]).includes(c),
    )
    expect(leaked).toEqual([])
    for (const c of SENSITIVE_PROFILE_COLUMNS) {
      expect(PUBLIC_SELLER_PROFILE_SELECT).not.toMatch(new RegExp(`\\b${c}\\b`))
    }
  })

  it('select literals stay in sync with the column arrays', () => {
    expect(PUBLIC_SELLER_PROFILE_SELECT.startsWith(PUBLIC_SELLER_PROFILE_COLUMNS.join(', ') + ', ')).toBe(true)
    expect(PUBLIC_REVIEW_SELECT.startsWith(PUBLIC_REVIEW_COLUMNS.join(', ') + ', ')).toBe(true)
  })

  it('review allowlist excludes moderation state', () => {
    for (const c of SENSITIVE_REVIEW_COLUMNS) {
      expect(PUBLIC_REVIEW_COLUMNS as readonly string[]).not.toContain(c)
      expect(PUBLIC_REVIEW_SELECT).not.toMatch(new RegExp(`\\b${c}\\b`))
    }
  })

  it('allowlist covers every profile field SellerStorefront renders', () => {
    const used = new Set(
      [...STOREFRONT.matchAll(/profile\.([a-z_]+)/g)].map((m) => m[1]),
    )
    for (const f of used) {
      expect(PUBLIC_SELLER_PROFILE_COLUMNS as readonly string[]).toContain(f)
    }
  })

  it('page never selects * from profiles or reviews and uses the allowlist', () => {
    expect(PAGE).not.toMatch(/from\('profiles'\)[\s\S]{0,120}select\(\s*[`'"]\s*\*/)
    expect(PAGE).not.toMatch(/from\('reviews'\)[\s\S]{0,120}select\(\s*[`'"]\s*\*/)
    // Invariant: EVERY profiles/reviews select on this page goes through the
    // allowlist — asserted as a ratio rather than a fixed count, so that
    // de-duplicating a query (STATE-004 collapsed the metadata + body profile
    // lookups into one cached fetcher) cannot be mistaken for a regression.
    const profileSelects = (PAGE.match(/\.from\('profiles'\)[\s\S]{0,160}?\.select\(/g) ?? []).length
    const profileAllowlisted = (PAGE.match(/\.select\(PUBLIC_SELLER_PROFILE_SELECT\)/g) ?? []).length
    expect(profileSelects).toBeGreaterThan(0)
    expect(profileAllowlisted).toBe(profileSelects)

    // Reviews: the storefront list is the only full-row read (the other two
    // select just 'rating' for the average), so the allowlist count is fixed.
    expect((PAGE.match(/\.select\(PUBLIC_REVIEW_SELECT\)/g) ?? []).length).toBe(1)
  })

  it('every reviews query on the page is filtered to visible reviews', () => {
    const reviewsQueries = (PAGE.match(/\.from\('reviews'\)/g) ?? []).length
    const visibleFilters = (PAGE.match(/\.eq\('is_visible', true\)/g) ?? []).length
    expect(reviewsQueries).toBeGreaterThan(0)
    expect(visibleFilters).toBe(reviewsQueries)
  })
})

// ── Integration: the exploit (reading PII through the page's own query) fails ──
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const runIntegration = Boolean(URL && KEY)

describe.skipIf(!runIntegration)('AUTH-001 — live select returns only allowlisted keys', () => {
  it('profile row from the page query has no sensitive keys', async () => {
    // Skip rather than fail when the configured stack isn't running.
    if (!(await supabaseReachable())) return
    const svc = createClient(URL!, KEY!, { auth: { persistSession: false } })
    const { data, error } = await svc.from('profiles').select(PUBLIC_SELLER_PROFILE_SELECT).limit(1)
    if (error) throw error
    if (!data || data.length === 0) return // nothing seeded — nothing to leak
    const keys = Object.keys(data[0] as unknown as Record<string, unknown>)
    const allowed = new Set<string>([...PUBLIC_SELLER_PROFILE_COLUMNS, 'seller_applications'])
    expect(keys.filter((k) => !allowed.has(k))).toEqual([])
    for (const c of SENSITIVE_PROFILE_COLUMNS) expect(keys).not.toContain(c)
  })
})
