/**
 * ROUTE-006 — /listings/[id] must be a server-side resolver, not a client page
 * that soft-404s.
 *
 * It used to be 'use client' with no generateMetadata (every listing inherited
 * root metadata) and rendered an in-body "Listing not found" card under HTTP
 * 200. That is the soft-404 pattern commit c8cb309 removed from the
 * marketplace tree, and this route is crawlable: /shop/[slug] sets
 * robots:{index:true} and links here via SellerStorefront.
 *
 * The route is kept (id-shaped URLs are already published) but now only
 * resolves the id to the canonical slug URL and 301s, or calls a real
 * notFound().
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import { listingUrl } from '@/lib/listings/url'

const PAGE = 'src/app/listings/[id]/page.tsx'
const source = readFileSync(PAGE, 'utf8')

describe('ROUTE-006 — /listings/[id] is a server resolver', () => {
  it('is not a client component', () => {
    expect(source).not.toMatch(/^'use client'/m)
  })

  it('exports generateMetadata', () => {
    expect(source).toMatch(/export async function generateMetadata/)
  })

  it('calls a real notFound() instead of rendering an error card', () => {
    expect(source).toMatch(/notFound\(\)/)
    // The old page rendered <h1>Listing not found</h1> under a 200. Match the
    // JSX specifically — the phrase also appears in this file's own docstring.
    expect(source).not.toMatch(/<h1[^>]*>\s*Listing not found/i)
    expect(source).not.toMatch(/return \(\s*<main/)
  })

  it('redirects permanently to the canonical URL', () => {
    expect(source).toMatch(/permanentRedirect\(/)
  })

  it('shape-checks the id before querying', () => {
    expect(source).toMatch(/isUuid\(/)
  })

  it('marks itself noindex — the canonical page owns the metadata', () => {
    expect(source).toMatch(/index: false/)
  })
})

describe('ROUTE-006 — link sources point at the canonical URL', () => {
  for (const file of [
    'src/components/shop/SellerStorefront.tsx',
    'src/components/listing-card.tsx',
  ]) {
    it(`${file} no longer hardcodes /listings/\${id}`, () => {
      const s = readFileSync(file, 'utf8')
      expect(s).toMatch(/listingUrl\(/)
      expect(s).not.toMatch(/href=\{`\/listings\/\$\{/)
    })
  }
})

describe('ROUTE-006 — listingUrl()', () => {
  const full = {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'rare-og-account-abc123',
    game: { slug: 'fortnite' },
    category: { slug: 'buy-accounts' },
  }

  it('builds the canonical URL when every slug is present', () => {
    expect(listingUrl(full)).toBe('/fortnite/buy-accounts/rare-og-account-abc123')
  })

  it('falls back to the resolver when the listing slug is null', () => {
    // listings.slug is nullable — the DB carries a partial index
    // `WHERE slug IS NOT NULL`.
    expect(listingUrl({ ...full, slug: null })).toBe(`/listings/${full.id}`)
  })

  it('falls back when the game or category join is missing', () => {
    expect(listingUrl({ ...full, game: null })).toBe(`/listings/${full.id}`)
    expect(listingUrl({ ...full, category: null })).toBe(`/listings/${full.id}`)
  })
})
