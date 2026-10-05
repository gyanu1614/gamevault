import { describe, expect, it } from 'vitest'

import {
  fetchCatalogPages,
  listPageUrl,
  parseListPage,
} from '../../../scripts/lib/adoptmevalues-catalog.mjs'
import {
  cleanEldoradoOffer,
  crawlEldoradoPets,
  isToyTitle,
  itemNameOf,
  traitValue,
} from '../../../scripts/lib/adoptme-eldorado.mjs'

function card(slug: string, name: string, rarity: string) {
  return (
    `<a href="/values/${slug}"><div><img alt="${name}" src="https://fetch-images.b-cdn.net/images/pets/${name}.png"/>` +
    `<p class="font-bold uppercase tracking-wider mt-0.5">${rarity}</p>` +
    `<p class="text-sm font-extrabold text-app-primary">15</p>` +
    `<span>N <!-- -->44</span><span>M <!-- -->1.2K</span></div></a>`
  )
}

describe('adoptmevalues catalog', () => {
  it('parses a card, two-word rarity and K suffixes', () => {
    const [pet] = parseListPage(card('crocodile', 'Crocodile', 'ultra rare'))
    expect(pet).toMatchObject({
      slug: 'crocodile',
      name: 'Crocodile',
      rarity: 'ultra_rare',
      image_url: 'https://fetch-images.b-cdn.net/images/pets/Crocodile.png',
      trade_values: { N: 15, NEON: 44, MEGA: 1200 },
    })
  })

  it('keeps unknown rarities (null) for the caller to log', () => {
    const [pet] = parseListPage(card('odd', 'Odd Pet', 'mythic'))
    expect(pet.rarity).toBeNull()
    expect(pet.rarity_raw).toBe('mythic')
  })

  it('walks /values/page/N until a page has no cards, deduping seams', async () => {
    const pages: Record<number, string> = {
      1: card('a', 'A', 'common') + card('b', 'B', 'rare'),
      2: card('b', 'B', 'rare') + card('c', 'C', 'legendary'),
      3: '<div>no cards</div>',
    }
    const asked: number[] = []
    const res = await fetchCatalogPages({
      delayMs: 0,
      fetchPage: async (n: number) => (asked.push(n), pages[n] ?? ''),
    })
    expect(res.pets.map((p: { slug: string }) => p.slug)).toEqual(['a', 'b', 'c'])
    expect(res.stoppedBy).toBe('empty-page')
    expect(asked).toEqual([1, 2, 3])
    expect(listPageUrl(1)).toBe('https://www.adoptmevalues.app/values')
    expect(listPageUrl(2)).toBe('https://www.adoptmevalues.app/values/page/2')
  })

  it('stops at the page ceiling', async () => {
    const res = await fetchCatalogPages({
      delayMs: 0,
      maxPages: 2,
      fetchPage: async (n: number) => card(`p${n}`, `P${n}`, 'rare'),
    })
    expect(res.pets).toHaveLength(2)
    expect(res.stoppedBy).toBe('max-pages')
  })
})

const OLD = Date.parse('2020-01-01T00:00:00Z')
function offer(over: {
  id?: string
  name?: string
  title?: string
  trait?: string | null
  legacyTrait?: string
  price?: number
  reviews?: number
}) {
  return {
    offer: {
      id: over.id ?? Math.random().toString(36),
      offerTitle: over.title ?? `FR ${over.name ?? 'Owl'}`,
      tradeEnvironmentValues: [
        { name: 'Item type', value: 'Pets' },
        { name: 'Item name', value: over.name ?? 'Owl' },
      ],
      offerAttributeIdValues: over.legacyTrait ? [{ name: 'Traits', value: over.legacyTrait }] : [],
      attributes:
        over.trait === null
          ? []
          : [{ name: 'Traits', value: { name: over.trait ?? 'FR', id: 'x' } }],
      pricePerUnit: { amount: over.price ?? 60, currency: 'USD' },
      quantity: 1,
    },
    user: { id: 'seller-1', createdDate: '2020-01-01T00:00:00Z' },
    userOrderInfo: { ratingCount: over.reviews ?? 5000, feedbackScore: 99 },
  }
}

describe('Eldorado offer reading', () => {
  it('reads the trait from the current and the legacy response shape', () => {
    expect(traitValue(offer({ trait: 'NFR' }).offer)).toBe('NFR')
    expect(traitValue(offer({ trait: null, legacyTrait: 'MFR' }).offer)).toBe('MFR')
    expect(itemNameOf(offer({ name: 'Bat Dragon' }).offer)).toBe('Bat Dragon')
  })

  it("a pet whose own name has a toy word is not dropped; a toy still is", () => {
    expect(isToyTitle('FR Castle Hermit Crab', 'Castle Hermit Crab')).toBe(false)
    expect(isToyTitle('Shadow Dragon Ducky', 'Shadow Dragon')).toBe(true)
  })

  it('trait wins, title fills in, a conflict drops', () => {
    const now = OLD + 1000 * 86400000
    expect(cleanEldoradoOffer(offer({ trait: 'MFR', title: 'Owl' }), { petName: 'Owl', nowMs: now }))
      .toMatchObject({ ok: true, listing: { variant: 'MFR', priceUsd: 60, reviews: 5000 } })
    expect(cleanEldoradoOffer(offer({ trait: null, title: 'NFR Owl' }), { petName: 'Owl', nowMs: now }))
      .toMatchObject({ ok: true, listing: { variant: 'NFR' } })
    expect(cleanEldoradoOffer(offer({ trait: 'FR', title: 'MFR Owl' }), { petName: 'Owl', nowMs: now }))
      .toEqual({ ok: false, reason: 'variant-conflict' })
  })
})

describe('crawlEldoradoPets', () => {
  it('groups by Item name, dedupes seam repeats, follows totalPages', async () => {
    const p1 = [offer({ id: '1', name: 'Owl' }), offer({ id: '2', name: 'Fairy Bat Dragon', trait: 'NFR', title: 'Fairy Bat Dragon NFR' })]
    const p2 = [offer({ id: '2', name: 'Fairy Bat Dragon', trait: 'NFR' }), offer({ id: '3', name: 'owl', title: 'Owl Ducky' })]
    const pages: Record<number, unknown> = {
      1: { recordCount: 4, totalPages: 2, results: p1 },
      2: { recordCount: 4, totalPages: 2, results: p2 },
    }
    const crawl = await crawlEldoradoPets({ delayMs: 0, fetchPage: async (n: number) => pages[n] })
    expect(crawl.pagesFetched).toBe(2)
    expect(crawl.duplicates).toBe(1)
    expect(crawl.byName.get('owl')).toMatchObject({ offers: 2 })
    expect(crawl.byName.get('owl')?.listings).toHaveLength(1) // the Ducky is a toy
    expect(crawl.byName.get('fairy bat dragon')?.listings[0]).toMatchObject({ variant: 'NFR' })
    expect(crawl.rejected).toEqual({ toy: 1 })
  })
  it("walks dearest-first past Eldorado's 1000-page cap until the passes meet", async () => {
    // 1,003 pages of one offer each; the API refuses pageIndex > 1000.
    const total = 1003
    const asked: string[] = []
    const fetchPage = async (n: number, ascending: boolean) => {
      asked.push(`${ascending ? 'a' : 'd'}${n}`)
      if (n > 1000) throw new Error('400')
      const idx = ascending ? n : total + 1 - n
      return {
        recordCount: total,
        totalPages: total,
        results: [offer({ id: `o${idx}`, name: 'Owl', price: idx })],
      }
    }
    const crawl = await crawlEldoradoPets({ delayMs: 0, fetchPage })
    expect(crawl.stoppedBy).toBe('complete')
    expect(crawl.uniqueOffers).toBe(total)
    expect(asked.filter((a) => a.startsWith('a'))).toHaveLength(1000)
    expect(asked.filter((a) => a.startsWith('d'))).toEqual(['d1', 'd2', 'd3'])
    expect(crawl.byName.get('owl')?.listings).toHaveLength(total)
  })
})
