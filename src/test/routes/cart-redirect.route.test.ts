/**
 * ROUTE-007 — /cart is a deprecated stub and should redirect server-side.
 *
 * It was a 'use client' page whose whole job was router.replace('/browse')
 * inside a useEffect, behind a spinner: 200 + a JS bundle + a layout shift
 * where one 307 will do. It also sat in PROTECTED_ROUTE_PREFIXES, so a
 * logged-out visitor was bounced to /login and, after authenticating, landed
 * on a spinner that threw them to /browse — an auth round-trip for a dead
 * route.
 *
 * The sibling deprecated stubs (/wallet, /purchases, /wishlist, /reviews) all
 * use a bare server redirect(); /cart now matches them.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import {
  PROTECTED_ROUTE_PREFIXES,
  isProtectedPath,
} from '@/lib/auth/protected-routes'

const raw = readFileSync('src/app/cart/page.tsx', 'utf8')
// Strip block comments before asserting on behaviour — the file's own
// docstring names the old useEffect/router.replace pattern it replaced.
const source = raw.replace(/\/\*[\s\S]*?\*\//g, '')

describe('ROUTE-007 — /cart redirects server-side', () => {
  it('is not a client component', () => {
    expect(source).not.toMatch(/^'use client'/m)
  })

  it('uses a server redirect, not a router effect or a spinner', () => {
    expect(source).toMatch(/redirect\('\/browse'\)/)
    expect(source).not.toMatch(/useEffect/)
    expect(source).not.toMatch(/router\.replace/)
    expect(source).not.toMatch(/Loader2/)
  })

  it('matches the sibling deprecated stubs', () => {
    // /wishlist is the reference shape: import redirect, call it, nothing else.
    const wishlist = readFileSync('src/app/wishlist/page.tsx', 'utf8')
    for (const s of [raw, wishlist]) {
      expect(s).toMatch(/import \{ redirect \} from 'next\/navigation'/)
    }
  })
})

describe('ROUTE-007 — /cart is no longer auth-gated', () => {
  it('is not a protected prefix', () => {
    expect(PROTECTED_ROUTE_PREFIXES).not.toContain('/cart')
    expect(isProtectedPath('/cart')).toBe(false)
  })

  it('leaves the real money routes gated', () => {
    // Guard against an over-broad edit: /checkout must stay protected.
    expect(isProtectedPath('/checkout')).toBe(true)
    expect(isProtectedPath('/checkout/abc')).toBe(true)
    expect(isProtectedPath('/account')).toBe(true)
  })
})
