import { describe, expect, it } from 'vitest'
import { buildLegalToc, findLegalAnchor, parseLegalHeading, slugifyHeading } from './toc'
import { LEGAL_DOCS } from '@/lib/legal/documents'

describe('parseLegalHeading', () => {
  it('splits a leading clause number from the label', () => {
    expect(parseLegalHeading('1. Introduction')).toEqual({ number: '1', label: 'Introduction' })
    expect(parseLegalHeading('12. Cancellations before delivery')).toEqual({
      number: '12',
      label: 'Cancellations before delivery',
    })
  })

  it('leaves an unnumbered heading whole', () => {
    expect(parseLegalHeading('Buyer fee')).toEqual({ number: null, label: 'Buyer fee' })
    expect(parseLegalHeading('Complaints duty (2026)')).toEqual({ number: null, label: 'Complaints duty (2026)' })
  })
})

describe('slugifyHeading', () => {
  it('produces url-safe slugs from legal headings', () => {
    expect(slugifyHeading('Lawful bases (UK GDPR Art. 6) — mapped to purpose')).toBe(
      'lawful-bases-uk-gdpr-art-6-mapped-to-purpose',
    )
    expect(slugifyHeading('DropMarket’s supporting, risk-based programme')).toBe(
      'dropmarkets-supporting-risk-based-programme',
    )
    expect(slugifyHeading('Fees & charges')).toBe('fees-and-charges')
  })
})

describe('buildLegalToc', () => {
  it('maps headed sections to anchors and skips preambles', () => {
    const toc = buildLegalToc([
      { blocks: [] } as { h?: string },
      { h: '1. Overview' },
      { h: '2. Protection Windows by category' },
    ])
    expect(toc).toEqual([
      { id: '1-overview', number: '1', label: 'Overview', sectionIndex: 1 },
      { id: '2-protection-windows-by-category', number: '2', label: 'Protection Windows by category', sectionIndex: 2 },
    ])
  })

  it('de-duplicates repeated headings', () => {
    const ids = buildLegalToc([{ h: 'Contact' }, { h: 'Contact' }, { h: 'Contact' }]).map((e) => e.id)
    expect(ids).toEqual(['contact', 'contact-2', 'contact-3'])
  })

  it('gives every real legal document unique, non-empty anchors', () => {
    for (const doc of LEGAL_DOCS) {
      const toc = buildLegalToc(doc.sections)
      const ids = toc.map((e) => e.id)
      expect(new Set(ids).size, doc.slug).toBe(ids.length)
      for (const id of ids) expect(id, doc.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(toc.length, doc.slug).toBe(doc.sections.filter((s) => s.h).length)
    }
  })

  it('never rewrites heading text: number + label reassemble the original', () => {
    for (const doc of LEGAL_DOCS) {
      for (const e of buildLegalToc(doc.sections)) {
        const original = doc.sections[e.sectionIndex].h!
        expect(e.number ? `${e.number}. ${e.label}` : e.label).toBe(original)
      }
    }
  })
})

describe('findLegalAnchor', () => {
  it('finds a section by label prefix, ignoring its number', () => {
    const sections = [{ h: '5. How to request a refund or raise a dispute (the process)' }]
    expect(findLegalAnchor(sections, 'How to request a refund')).toBe(
      '5-how-to-request-a-refund-or-raise-a-dispute-the-process',
    )
    expect(findLegalAnchor(sections, 'Nothing like this')).toBeNull()
  })
})
