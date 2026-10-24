import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEGAL_DOCS } from '@/lib/legal/documents'
import { LEGAL_GROUPS, LEGAL_PARTS, groupedLegalDocs, legalDocHref, legalPageParts, legalPageSlug, relatedLegalDocs } from './legal-nav'

// Legal pages render under (legal); /fees renders from (marketing), with the
// document's fee terms at the bottom of the page (2026-10-23 redesign).
const ROUTE_DIRS = ['(legal)', '(marketing)'].map((g) => join(process.cwd(), 'src/app', g))
const routeExists = (slug: string) => ROUTE_DIRS.some((dir) => existsSync(join(dir, slug, 'page.tsx')))
const PART_SLUGS = Object.values(LEGAL_PARTS).flat()

describe('legal navigation', () => {
  it('every page has a route; every part points at its host page’s anchor', () => {
    for (const doc of LEGAL_DOCS) {
      expect(routeExists(legalPageSlug(doc.slug)), doc.slug).toBe(true)
    }
    expect(legalDocHref('buyer-terms')).toBe('/terms#part-buyer-terms')
    expect(legalDocHref('safedrop')).toBe('/refunds#part-safedrop')
    expect(legalDocHref('acceptable-use')).toBe('/trust-safety#part-acceptable-use')
    expect(legalDocHref('privacy')).toBe('/privacy')
  })

  it('a merged document no longer has a page of its own (its old URL redirects)', () => {
    for (const slug of PART_SLUGS) expect(existsSync(join(ROUTE_DIRS[0], slug, 'page.tsx')), slug).toBe(false)
    expect(existsSync(join(ROUTE_DIRS[0], 'safedrop-policy', 'page.tsx'))).toBe(false)
  })

  it('every document is either a grouped page or a part, exactly once', () => {
    const pages = LEGAL_GROUPS.flatMap((g) => g.slugs)
    expect(new Set(pages).size).toBe(pages.length)
    expect([...pages, ...PART_SLUGS].sort()).toEqual(LEGAL_DOCS.map((d) => d.slug).sort())
    expect(groupedLegalDocs().flatMap((g) => g.docs).map((d) => d.slug).sort()).toEqual([...pages].sort())
  })

  it('a host page lists its parts in order', () => {
    expect(legalPageParts('refunds').map((d) => d.slug)).toEqual(['safedrop', 'chargebacks'])
    expect(legalPageParts('privacy')).toEqual([])
  })

  it('lists related pages that exist and never the page itself', () => {
    for (const doc of LEGAL_DOCS) {
      const related = relatedLegalDocs(doc.slug)
      expect(related.length, doc.slug).toBeGreaterThan(0)
      expect(related.map((d) => d.slug), doc.slug).not.toContain(legalPageSlug(doc.slug))
      for (const r of related) expect(PART_SLUGS, `${doc.slug} → ${r.slug}`).not.toContain(r.slug)
    }
  })
})
