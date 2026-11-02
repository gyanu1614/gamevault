import { describe, expect, it } from 'vitest'
import pages from './__fixtures__/mm2-pages.json'
import { murderMystery2, parseMm2Page } from './murder-mystery-2'
import { parseBoxPage, type ObtainSource } from '../../values/catalogue/mm2-wiki'
import { buildMarketIndex, resolveMarketKey } from '../../values/catalogue/resolve'
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

  it('lists weapons, pets and every page with an item infobox', () => {
    expect(murderMystery2.listQueries).toEqual([
      { list: 'categorymembers', title: 'Category:Weapons' },
      { list: 'categorymembers', title: 'Category:Pets' },
      { list: 'embeddedin', title: 'Template:Infobox Item' },
    ])
  })
})

/**
 * 2026-11-02: Eldorado sold these, but their wiki pages are not in
 * Category:Weapons (Sunset (2026) has no category at all), so the daily
 * listing never read them; Dolphins was read, as a gun. Real pages.
 */
describe('items the weapons listing missed', () => {
  const summerBox = page('2025 Summer Box')
  const boxes = [...BOXES, parseBoxPage(summerBox.title, summerBox.content)]
  const missed = ['Bones (2016)', 'Pool Knife (Summer 2025)', 'Stickers (Thanksgiving 2025)', 'Sunset (2026)', 'Dolphins']

  it('none of them is in Category:Weapons, and every one has an item infobox', () => {
    for (const t of missed.slice(0, 4)) expect(page(t).categories, t).not.toContain('Category:Weapons')
    for (const t of missed) expect(page(t).content, t).toMatch(/\{\{\s*Infobox[ _]Item/i)
  })

  it('each parses to the item Eldorado sells, and its Eldorado name resolves to it', () => {
    const items = missed.map((t) => parseMm2Page(page(t), boxes, '2026-11-02')!)
    expect(items.map((i) => [i.slug, i.extra.itemType, i.extra.releaseYear])).toEqual([
      ['bones-2016', 'knife', 2016],
      ['pool-knife-summer-2025', 'knife', 2025],
      ['stickers-thanksgiving-2025', 'knife', 2025],
      ['sunset-2026', 'gun', 2026],
      ['dolphins', 'knife', 2025],
    ])
    const index = buildMarketIndex([
      ...items.map((i) => ({ slug: i.slug, title: i.wikiTitle, displayTitle: i.extra.displayTitle as string | null, itemType: i.extra.itemType as string, isChroma: false, releaseYear: i.extra.releaseYear as number, origin: i.origin })),
      { slug: 'sunset', title: 'Sunset', itemType: 'knife', isChroma: false, releaseYear: 2025 },
      { slug: 'bones-2020', title: 'Bones (2020)', itemType: 'knife', isChroma: false, releaseYear: 2020 },
    ])
    const eldorado = ['knife|default|bones 2016', 'knife|default|pool 2025', 'knife|default|stickers thanksgiving 2025', 'gun|default|sunset 2026', 'knife|default|dolphins 2025']
    expect(eldorado.map((key) => resolveMarketKey(key, index).slug)).toEqual(items.map((i) => i.slug))
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
