import { describe, expect, it } from 'vitest'
import pages from './__fixtures__/mm2-pages.json'
import { murderMystery2, parseMm2Page } from './murder-mystery-2'
import { parseBoxPage, type ObtainSource } from '../../values/catalogue/mm2-wiki'
import type { ParsedItem, WikiClient, WikiPage } from '../types'

const page = (title: string) => (pages as WikiPage[]).find((p) => p.title === title)!
const box = page('2026 Halloween Box')
const BOXES = [parseBoxPage(box.title, box.content)]

describe('parseMm2Page', () => {
  it('reads a weapon page: type, rarity, picture, year and a How To Get', () => {
    const item = parseMm2Page(page('Emberbow'), BOXES, '2026-10-22')!
    expect(item).toMatchObject({
      slug: 'emberbow',
      name: 'Emberbow',
      rarity: 'Ancient',
      imageFile: 'Emberbow.png',
      pageUrl: 'https://murder-mystery-2.fandom.com/wiki/Emberbow',
      extra: { itemType: 'gun', isChroma: false, baseTitle: null, releaseYear: 2026 },
    })
    expect(item.howToGet).toMatchObject({ status: 'obtainable', method: 'Tier Reward in the Halloween Event 2026.' })
  })

  it('a Chroma knows its standard item', () => {
    expect(parseMm2Page(page('Chroma Emberbow'), BOXES, '2026-10-22')).toMatchObject({ rarity: 'Chroma', extra: { isChroma: true, baseTitle: 'Emberbow' } })
  })

  it('takes the box odds and both prices from the box page', () => {
    const item = parseMm2Page(page('Embersickle'), BOXES, '2026-10-22')!
    expect(item.howToGet).toMatchObject({ costs: '600 Candies or 1 Halloween Key', odds: '0.2%' })
  })

  it('a blank page, an event page and a box page are not items', () => {
    for (const t of ['Embergun', 'Halloween Event 2026', '2026 Halloween Box']) expect(parseMm2Page(page(t), BOXES, '2026-10-22'), t).toBeNull()
  })

  it('lists weapons and pets', () => {
    expect(murderMystery2.listQueries).toEqual([
      { list: 'categorymembers', title: 'Category:Weapons' },
      { list: 'categorymembers', title: 'Category:Pets' },
    ])
  })
})

describe('murderMystery2.prepare + enrich', () => {
  const fakeWiki = (texts: Record<string, string>): WikiClient =>
    ({
      listPages: async () => [{ pageId: box.pageId, title: box.title }],
      fetchPages: async () => [box],
      wikitext: async (title: string) => {
        if (!(title in texts)) throw new Error('missingtitle')
        return texts[title]
      },
    }) as unknown as WikiClient

  it('prepare parses every box page once', async () => {
    const ctx = await murderMystery2.prepare!(fakeWiki({}))
    expect((ctx.boxes as unknown[]).length).toBe(1)
  })

  it('enrich fills a gamepass price from its page and rewrites the How To Get; a missing page is skipped', async () => {
    const base = parseMm2Page(page('Emberbow'), BOXES, '2026-10-22')!
    const gamepass: ObtainSource = { kind: 'gamepass', name: 'Mortal Bundle', year: 2026, method: null, cost: null, odds_pct: null, still_obtainable: true, wiki_page: 'Mortal Bundle' }
    const missing: ObtainSource = { ...gamepass, name: 'Gone Pass', wiki_page: 'Gone Pass' }
    const item: ParsedItem = { ...base, slug: 'mortal', extra: { ...base.extra, obtain: [gamepass, missing] } }
    const [out] = await murderMystery2.enrich!([item], fakeWiki({ 'Mortal Bundle': 'The Mortal Bundle is purchasable for 3,399 Robux.' }), { checkedAt: '2026-10-22' })
    expect((out.extra.obtain as ObtainSource[])[0].cost).toEqual({ amount: 3399, currency: 'Robux' })
    expect(out.howToGet).toMatchObject({ method: expect.stringContaining('Mortal Bundle gamepass'), costs: '3,399 Robux' })
  })
})
