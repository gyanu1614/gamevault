import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEGAL_DOCS } from '@/lib/legal/documents'
import { LEGAL_GROUPS, groupedLegalDocs, legalDocHref, relatedLegalDocs } from './legal-nav'

// Legal documents render under (legal); /fees renders from (marketing), with the
// document's fee terms at the bottom of the page (2026-10-23 redesign).
const ROUTE_DIRS = ['(legal)', '(marketing)'].map((g) => join(process.cwd(), 'src/app', g))

describe('legal navigation', () => {
  it('maps every document to an existing route (safedrop -> /safedrop-policy)', () => {
    expect(legalDocHref('safedrop')).toBe('/safedrop-policy')
    for (const doc of LEGAL_DOCS) {
      const href = legalDocHref(doc.slug)
      expect(ROUTE_DIRS.some((dir) => existsSync(join(dir, href.slice(1), 'page.tsx'))), href).toBe(true)
    }
  })

  it('places every document in exactly one group', () => {
    const slugs = LEGAL_GROUPS.flatMap((g) => g.slugs)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect([...slugs].sort()).toEqual(LEGAL_DOCS.map((d) => d.slug).sort())
    expect(groupedLegalDocs().flatMap((g) => g.docs).length).toBe(LEGAL_DOCS.length)
  })

  it('lists related policies that exist and never the document itself', () => {
    for (const doc of LEGAL_DOCS) {
      const related = relatedLegalDocs(doc.slug)
      expect(related.length, doc.slug).toBeGreaterThan(0)
      expect(related.map((d) => d.slug), doc.slug).not.toContain(doc.slug)
    }
  })
})
