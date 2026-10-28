/**
 * Key Points boxes (2026-10-23): each sits on a real page (never a part,
 * which has no page of its own), is short enough to read at a glance, and
 * is written plainly (no em or en dash, the owner's human-copy rule).
 */
import { describe, it, expect } from 'vitest'

import { LEGAL_PARTS } from '@/components/legal/legal-nav'
import { LEGAL_DOCS } from './documents'
import { KEY_POINTS } from './key-points'

describe('KEY_POINTS', () => {
  const parts = new Set(Object.values(LEGAL_PARTS).flat())

  it('belongs to a page that exists and is not a part', () => {
    for (const slug of Object.keys(KEY_POINTS)) {
      expect(LEGAL_DOCS.some((d) => d.slug === slug), slug).toBe(true)
      expect(parts.has(slug), slug).toBe(false)
    }
  })

  it('covers the four main pages with 4 to 8 questions each', () => {
    for (const slug of ['terms', 'refunds', 'privacy', 'seller-agreement']) {
      const n = KEY_POINTS[slug]?.length ?? 0
      expect(n, slug).toBeGreaterThanOrEqual(4)
      expect(n, slug).toBeLessThanOrEqual(8)
    }
  })

  it('every question ends with "?", every answer is short and plain', () => {
    for (const [slug, points] of Object.entries(KEY_POINTS)) {
      for (const p of points) {
        expect(p.q.endsWith('?'), `${slug}: ${p.q}`).toBe(true)
        expect(p.a.split(/\s+/).length, `${slug}: ${p.q}`).toBeLessThanOrEqual(45)
        expect(`${p.q} ${p.a}`, `${slug}: ${p.q}`).not.toMatch(/[—–]/)
      }
    }
  })

  it('the Terms summary names the unwelcome terms, not just the good news', () => {
    const text = KEY_POINTS.terms.map((p) => p.a).join(' ')
    expect(text).toMatch(/ban/)
    expect(text).toMatch(/£100/)
    expect(text).toMatch(/chargeback/i)
  })
})
