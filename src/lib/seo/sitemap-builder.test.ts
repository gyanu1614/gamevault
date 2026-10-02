import { describe, it, expect } from 'vitest'

import { buildSitemap, type SitemapInput } from '@/lib/seo/sitemap-builder'

/**
 * The sitemap lists only URLs that return 200, are indexable and self-canonical,
 * and every entry carries a truthful lastmod. This builder is pure: the loader
 * (sitemap-data.ts) fetches, this decides. Fixture dates are fixed in the past.
 */
const BASE = 'https://dropmarket.gg'

function fixture(over: Partial<SitemapInput> = {}): SitemapInput {
  return {
    baseUrl: BASE,
    games: [
      { id: 'g1', slug: 'valorant', content_tier: 'listed', updated_at: '2026-09-02T00:00:00Z', seo_indexable: null },
      { id: 'g2', slug: 'fortnite', content_tier: 'listed', updated_at: '2026-09-03T00:00:00Z', seo_indexable: null },
      { id: 'g3', slug: 'steal-a-brainrot', content_tier: 'data', updated_at: '2026-09-04T00:00:00Z', seo_indexable: null },
      { id: 'g4', slug: 'adopt-me', content_tier: 'data', updated_at: '2026-09-05T00:00:00Z', seo_indexable: null },
      { id: 'g5', slug: 'steal-an-egg', content_tier: 'data', updated_at: '2026-09-06T00:00:00Z', seo_indexable: null },
      { id: 'g6', slug: 'gta-vi', content_tier: 'listed', updated_at: '2026-09-07T00:00:00Z', seo_indexable: null },
    ],
    categories: [
      { id: 'c1', slug: 'buy-vp', type: 'currency', game_id: 'g1' },
      { id: 'c2', slug: 'buy-items', type: 'items', game_id: 'g1' },
      { id: 'c3', slug: 'buy-accounts', type: 'account', game_id: 'g2' },
      { id: 'c4', slug: 'buy-items', type: 'items', game_id: 'g3' },
      // gta-vi has no enabled category: its only category row is disabled, so it is not loaded.
    ],
    currencyConfigs: [{ game_id: 'g1', config: { faq: [{ q: 'x' }], steps: [] }, updated_at: '2026-09-20T00:00:00Z' }],
    listings: [
      { slug: 'vp-1000', updated_at: '2026-09-28T09:00:00Z', game_id: 'g1', game_category_id: 'c1', seller_id: 'sA', price: 9.99 },
      { slug: 'vp-paused', updated_at: '2026-09-29T09:00:00Z', game_id: 'g1', game_category_id: 'c1', seller_id: 'sPaused', price: 5 },
      { slug: 'free-item', updated_at: '2026-09-27T09:00:00Z', game_id: 'g1', game_category_id: 'c2', seller_id: 'sA', price: 0 },
      { slug: 'sab-item', updated_at: '2026-09-26T09:00:00Z', game_id: 'g3', game_category_id: 'c4', seller_id: 'sA', price: 3 },
      // gta-vi: an active listing whose category is not an enabled category of that game
      { slug: 'gta-cash', updated_at: '2026-09-25T09:00:00Z', game_id: 'g6', game_category_id: 'cDisabled', seller_id: 'sA', price: 4 },
    ],
    pausedSellerIds: new Set(['sPaused']),
    sabBrainrots: [
      { slug: 'cavallo-virtuoso', updated_at: '2026-09-30T00:00:00Z' },
      { slug: 'tralalero', updated_at: '2026-09-18T00:00:00Z' },
    ],
    adoptMePets: [
      { slug: 'bat-dragon', updated_at: '2026-09-15T00:00:00Z' },
      { slug: 'shadow-dragon', updated_at: '2026-09-12T00:00:00Z' },
    ],
    pipelineItems: [
      { gameSlug: 'steal-an-egg', slug: 'golden-egg', priceChangedAt: '2026-09-22T00:00:00Z', sampleSize: 5 },
      { gameSlug: 'steal-an-egg', slug: 'thin-egg', priceChangedAt: '2026-09-23T00:00:00Z', sampleSize: 2 },
    ],
    gamePosts: [
      { slug: 'vp-guide', primary_game_slug: 'valorant', updated_at: '2026-09-10T00:00:00Z' },
      { slug: 'vp-tips', primary_game_slug: 'valorant', updated_at: '2026-09-14T00:00:00Z' },
    ],
    posts: [{ publishedAt: '2026-08-01' }, { publishedAt: '2026-08-20' }],
    flatPosts: [{ slug: 'how-we-work', publishedAt: '2026-08-20' }],
    landingSlugs: ['buy-fortnite-accounts'],
    ...over,
  }
}

const entries = (over?: Partial<SitemapInput>) => buildSitemap(fixture(over))
const urls = (over?: Partial<SitemapInput>) => entries(over).map((e) => e.url)
const find = (url: string, over?: Partial<SitemapInput>) => entries(over).find((e) => e.url === url)
const lastmod = (url: string, over?: Partial<SitemapInput>) => {
  const e = find(url, over)
  return e?.lastModified instanceof Date ? e.lastModified.toISOString() : (e?.lastModified as string | undefined)
}

describe('which URLs are listed', () => {
  it('lists a category that has a buyable listing', () => {
    expect(urls()).toContain(`${BASE}/valorant/buy-vp`)
  })

  it('does NOT list /gta-vi/buy-items: no enabled category, the page 404s (and neither is its listing)', () => {
    const all = urls()
    expect(all.filter((u) => u.includes('/gta-vi/'))).toEqual([])
    expect(all).not.toContain(`${BASE}/gta-vi/buy-items`)
  })

  it('does NOT list a category whose only listings are paused or free (page says noindex)', () => {
    const only = fixture({
      listings: [
        { slug: 'p', updated_at: '2026-09-29T00:00:00Z', game_id: 'g2', game_category_id: 'c3', seller_id: 'sPaused', price: 5 },
        { slug: 'z', updated_at: '2026-09-29T00:00:00Z', game_id: 'g2', game_category_id: 'c3', seller_id: 'sA', price: 0 },
      ],
    })
    expect(buildSitemap(only).map((e) => e.url)).not.toContain(`${BASE}/fortnite/buy-accounts`)
  })

  it('lists an empty currency category that has curated content', () => {
    expect(urls({ listings: [] })).toContain(`${BASE}/valorant/buy-vp`)
  })

  it('does not list an empty currency category whose config row is only the default', () => {
    expect(urls({ listings: [], currencyConfigs: [{ game_id: 'g1', config: { faq: [], steps: [] }, updated_at: '2026-09-20T00:00:00Z' }] })).not.toContain(`${BASE}/valorant/buy-vp`)
  })

  it('keeps every sell page of an active game with an enabled category (they bring traffic on Bing)', () => {
    const all = urls()
    for (const g of ['valorant', 'fortnite', 'steal-a-brainrot']) expect(all).toContain(`${BASE}/${g}/sell`)
    expect(all).not.toContain(`${BASE}/gta-vi/sell`) // no enabled category: nothing to sell
  })

  it('lists a game hub only when it has something real to rank', () => {
    const all = urls()
    expect(all).toContain(`${BASE}/valorant`) // buyable inventory
    expect(all).toContain(`${BASE}/steal-a-brainrot`) // data tier
    expect(all).not.toContain(`${BASE}/fortnite`) // listed tier, no listing
  })

  it('lists a pipeline value item only with a price backed by enough live listings', () => {
    const all = urls()
    expect(all).toContain(`${BASE}/steal-an-egg/values/golden-egg`)
    expect(all).not.toContain(`${BASE}/steal-an-egg/values/thin-egg`)
  })

  it('lists SAB and Adopt Me value items, and the hub pages their theme enables', () => {
    const all = urls()
    expect(all).toContain(`${BASE}/steal-a-brainrot/values/cavallo-virtuoso`)
    expect(all).toContain(`${BASE}/adopt-me/values/bat-dragon`)
    expect(all).toContain(`${BASE}/steal-a-brainrot/values`)
    expect(all).toContain(`${BASE}/adopt-me/neon-calculator`)
  })

  it('has no duplicate URLs', () => {
    const all = urls()
    expect(new Set(all).size).toBe(all.length)
  })

  it('every URL is an absolute https URL on the site origin with no query or fragment', () => {
    for (const u of urls()) {
      expect(u.startsWith(`${BASE}`)).toBe(true)
      expect(u).not.toMatch(/[?#]/)
      expect(u.endsWith('/') && u !== `${BASE}/`).toBe(false)
    }
  })
})

describe('every entry has a truthful lastmod', () => {
  it('no entry is missing one', () => {
    const missing = entries().filter((e) => !e.lastModified).map((e) => e.url)
    expect(missing).toEqual([])
  })

  it('no entry is dated "now" (a blanket build time trains Google to ignore the field)', () => {
    const now = Date.now()
    for (const e of entries()) {
      const t = new Date(e.lastModified as string | Date).getTime()
      expect(Number.isNaN(t), e.url).toBe(false)
      expect(now - t, `${e.url} is dated within the last minute`).toBeGreaterThan(60_000)
    }
  })

  it('dates come from the data behind each page', () => {
    expect(lastmod(`${BASE}/steal-a-brainrot/values/cavallo-virtuoso`)).toBe('2026-09-30T00:00:00Z')
    expect(lastmod(`${BASE}/adopt-me/values/bat-dragon`)).toBe('2026-09-15T00:00:00Z')
    expect(lastmod(`${BASE}/steal-an-egg/values/golden-egg`)).toBe('2026-09-22T00:00:00Z')
    expect(lastmod(`${BASE}/valorant/buy-vp/vp-1000`)).toBe('2026-09-28T09:00:00Z')
    // category = newest buyable listing or curated config
    expect(lastmod(`${BASE}/valorant/buy-vp`)).toBe('2026-09-28T09:00:00Z')
    // hub = newest of the game row and its listings; sell page = the game row
    expect(lastmod(`${BASE}/valorant`)).toBe('2026-09-29T09:00:00Z')
    expect(lastmod(`${BASE}/valorant/sell`)).toBe('2026-09-02T00:00:00Z')
    // game blog index = newest post in that game
    expect(lastmod(`${BASE}/valorant/blog`)).toBe('2026-09-14T00:00:00Z')
    // global blog = newest post
    expect(lastmod(`${BASE}/blog`)).toBe('2026-08-20')
    // values hub, calculator and price index move with the price data
    expect(lastmod(`${BASE}/steal-a-brainrot/values`)).toBe('2026-09-30T00:00:00Z')
    expect(lastmod(`${BASE}/steal-a-brainrot/calculator`)).toBe('2026-09-30T00:00:00Z')
    expect(lastmod(`${BASE}/adopt-me/values`)).toBe('2026-09-15T00:00:00Z')
    // legal pages carry the legal pack's own "last updated" date
    expect(lastmod(`${BASE}/terms`)).toBe('2026-07-12')
  })

  it('home and browse follow the newest buyable listing (they show live listings)', () => {
    expect(lastmod(`${BASE}`)).toBe('2026-09-28T09:00:00Z')
    expect(lastmod(`${BASE}/browse`)).toBe('2026-09-28T09:00:00Z')
  })
})

describe('the homepage URL is exactly its canonical', () => {
  it('is the bare origin, which is what next/metadata resolves "/" to', () => {
    expect(urls()).toContain(BASE)
    expect(urls()).not.toContain(`${BASE}/`)
  })
})
