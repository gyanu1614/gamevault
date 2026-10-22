import { describe, expect, it } from 'vitest'
import { candidatePages, guardRun, planCatalogue, slugifyTitle } from './plan'
import type { CatalogueRef, ParsedItem } from './types'

const NOW = new Date('2026-10-21T12:00:00Z')
const ref = (pageId: number, status: 'item' | 'ignored', checkedAt = '2026-10-20T00:00:00Z'): CatalogueRef => ({
  pageId,
  wikiTitle: `P${pageId}`,
  itemSlug: status === 'item' ? `p${pageId}` : null,
  status,
  firstSeenAt: checkedAt,
  checkedAt,
})
const item = (pageId: number, name: string): ParsedItem => ({
  pageId,
  revisionId: 1,
  wikiTitle: name,
  pageUrl: `https://w/${pageId}`,
  slug: slugifyTitle(name),
  name,
  rarity: 'Secret',
  imageFile: null,
  releasedAt: null,
  origin: null,
  howToGet: null,
  extra: {},
})

describe('slugifyTitle', () => {
  it('matches the existing slug style', () => {
    expect(slugifyTitle('La Vacca Prese Presente')).toBe('la-vacca-prese-presente')
    expect(slugifyTitle("Traveler's Gun")).toBe('travelers-gun')
    expect(slugifyTitle('Wolf (2026)')).toBe('wolf-2026')
  })
})

describe('candidatePages', () => {
  const listed = [
    { pageId: 1, title: 'A' },
    { pageId: 2, title: 'B' },
    { pageId: 3, title: 'C' },
  ]
  it('reads pages we never decided about, never pages already matched to an item', () => {
    const refs = new Map([[1, ref(1, 'item')]])
    expect(candidatePages({ listed, recent: [], refs, now: NOW }).map((p) => p.pageId)).toEqual([2, 3])
  })
  it('adds pages created or edited recently that no listing has yet (uncategorised new pages)', () => {
    const out = candidatePages({ listed, recent: [{ pageId: 9, title: 'Embergun', isNew: true }], refs: new Map(), now: NOW })
    expect(out.map((p) => p.pageId)).toEqual([1, 2, 3, 9])
  })
  it('re-reads an ignored page when it was edited recently or not checked for 30 days', () => {
    const refs = new Map([
      [1, ref(1, 'ignored')],
      [2, ref(2, 'ignored', '2026-09-01T00:00:00Z')],
      [3, ref(3, 'ignored')],
    ])
    const out = candidatePages({ listed, recent: [{ pageId: 1, title: 'A', isNew: false }], refs, now: NOW })
    expect(out.map((p) => p.pageId)).toEqual([1, 2])
  })
})

describe('planCatalogue', () => {
  const known = [
    { slug: 'tralalero-tralala', name: 'Tralalero Tralala', pageId: 10 },
    { slug: 'los-tralaleritos', name: 'Los Tralaleritos', pageId: null },
  ]
  it('adopts by page id, slug or name; inserts the rest; ignores non-items', () => {
    const plan = planCatalogue(
      [
        { pageId: 10, title: 'Tralalero Tralala (renamed)', item: item(10, 'Tralalero Tralala Renamed') },
        { pageId: 11, title: 'Los Tralaleritos', item: item(11, 'Los Tralaleritos') },
        { pageId: 12, title: 'Slushi Huski', item: item(12, 'Slushi Huski') },
        { pageId: 13, title: 'Slushi Huski/Gallery', item: null },
      ],
      known,
    )
    expect(plan.adopt).toEqual([
      { pageId: 10, title: 'Tralalero Tralala (renamed)', slug: 'tralalero-tralala' },
      { pageId: 11, title: 'Los Tralaleritos', slug: 'los-tralaleritos' },
    ])
    expect(plan.insert.map((i) => i.slug)).toEqual(['slushi-huski'])
    expect(plan.ignore).toEqual([{ pageId: 13, title: 'Slushi Huski/Gallery' }])
  })
  it('never inserts two pages with the same slug in one run', () => {
    const plan = planCatalogue(
      [
        { pageId: 1, title: 'X', item: item(1, 'Cobra') },
        { pageId: 2, title: 'Y', item: item(2, 'Cobra') },
      ],
      [],
    )
    expect(plan.insert).toHaveLength(1)
    expect(plan.ignore).toEqual([{ pageId: 2, title: 'Y' }])
  })
})

describe('guardRun', () => {
  const base = { candidates: 100, parseErrors: 0, toInsert: 5, cap: 50, allowLarge: false }
  it('passes a normal run', () => expect(guardRun(base)).toEqual({ ok: true }))
  it('stops when many pages fail to parse (format change)', () => {
    expect(guardRun({ ...base, parseErrors: 21 })).toMatchObject({ ok: false })
    expect(guardRun({ ...base, candidates: 5, parseErrors: 2 })).toEqual({ ok: true })
  })
  it('stops over the cap unless allowed by hand', () => {
    expect(guardRun({ ...base, toInsert: 51 })).toMatchObject({ ok: false })
    expect(guardRun({ ...base, toInsert: 51, allowLarge: true })).toEqual({ ok: true })
  })
})
