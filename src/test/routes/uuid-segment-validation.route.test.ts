/**
 * ROUTE-009 — uuid-shaped dynamic segments should be shape-checked.
 *
 * src/lib/ids.ts documents isUuid as "reject malformed ids before they reach
 * the DB", but it had zero callers: [id]/[orderId] segments went straight into
 * .eq('id', ...). Every call site null-checked the result, so the outcome was
 * already a clean 404/redirect rather than a 500 — this is defence-in-depth
 * plus the removal of a dead exported helper, hence P3.
 *
 * Each guard mirrors ITS OWN route's existing miss behaviour, so a malformed
 * id stays indistinguishable from an absent one:
 *   /checkout/[id]            → redirect('/browse')
 *   /checkout/pay/[orderId]   → redirect('/account/orders')
 *   /account/orders/[orderId] → notFound()
 * The two legacy redirect stubs 404 instead of propagating a junk segment
 * into their redirect target.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import { isUuid } from '@/lib/ids'

describe('ROUTE-009 — isUuid', () => {
  it('accepts a v4 uuid', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true)
  })

  it('rejects malformed, empty and non-string input', () => {
    for (const bad of ['', 'not-a-uuid', '1234', '../../etc/passwd']) {
      expect(isUuid(bad)).toBe(false)
    }
    expect(isUuid(undefined)).toBe(false)
    expect(isUuid(null)).toBe(false)
    expect(isUuid(42)).toBe(false)
  })

  it('rejects a uuid with the wrong version or variant nibble', () => {
    // The regex pins v4 and the 8/9/a/b variant; assert that is intentional.
    expect(isUuid('11111111-1111-1111-8111-111111111111')).toBe(false)
    expect(isUuid('11111111-1111-4111-c111-111111111111')).toBe(false)
  })
})

describe('ROUTE-009 — uuid segments are guarded at the route', () => {
  const routes: [file: string, miss: RegExp][] = [
    ['src/app/checkout/[id]/page.tsx', /if \(!isUuid\(id\)\) redirect\('\/browse'\)/],
    [
      'src/app/checkout/pay/[orderId]/page.tsx',
      /if \(!isUuid\(orderId\)\) redirect\('\/account\/orders'\)/,
    ],
    ['src/app/account/orders/[orderId]/page.tsx', /if \(!isUuid\(orderId\)\) notFound\(\)/],
    ['src/app/orders/[orderId]/page.tsx', /if \(!isUuid\(orderId\)\) notFound\(\)/],
    ['src/app/account/listings/[id]/edit/page.tsx', /if \(!isUuid\(id\)\) notFound\(\)/],
    ['src/app/listings/[id]/page.tsx', /isUuid\(id\)/],
  ]

  for (const [file, miss] of routes) {
    it(`${file} guards its segment and matches the route's own miss behaviour`, () => {
      const source = readFileSync(file, 'utf8')
      expect(source).toMatch(/from '@\/lib\/ids'/)
      expect(source).toMatch(miss)
    })
  }
})

describe('ROUTE-009 — the helper is no longer dead code', () => {
  it('has callers outside its own module', () => {
    const files = [
      'src/app/checkout/[id]/page.tsx',
      'src/app/checkout/pay/[orderId]/page.tsx',
      'src/app/account/orders/[orderId]/page.tsx',
      'src/app/orders/[orderId]/page.tsx',
      'src/app/account/listings/[id]/edit/page.tsx',
      'src/app/listings/[id]/page.tsx',
    ]
    const callers = files.filter((f) => readFileSync(f, 'utf8').includes('isUuid('))
    expect(callers.length).toBe(files.length)
  })
})
