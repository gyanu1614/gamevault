import { describe, it, expect } from 'vitest'

import { buildSitemap, type SitemapInput } from '@/lib/seo/sitemap-builder'
import { SITEMAP_BASE, sitemapFixture } from '../../test/fixtures/sitemap-input'

/**
 * The sitemap lists only URLs that return 200, are indexable and self-canonical,
 * and every entry carries a truthful lastmod. This builder is pure: the loader
 * (sitemap-data.ts) fetches, this decides. Fixture dates are fixed in the past.
 */
const BASE = SITEMAP_BASE
const fixture = sitemapFixture

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

  it('does NOT list currency listings (no page of their own: the URL 308s to the currency page)', () => {
    const all = urls()
    expect(all.filter((u) => u.startsWith(`${BASE}/valorant/buy-vp/`))).toEqual([])
    expect(all).toContain(`${BASE}/valorant/buy-vp`) // the currency page itself stays
    expect(all).toContain(`${BASE}/steal-a-brainrot/buy-items/sab-item`) // item listings unchanged
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

  it('lists a value-list hub item (MM2) only when it has a page: high tier, priced, enough listings', () => {
    const all = urls({
      pipelineItems: [
        { gameSlug: 'murder-mystery-2', slug: 'harvester', rarity: 'Ancient', priceChangedAt: '2026-10-05T00:00:00Z', sampleSize: 63 },
        { gameSlug: 'murder-mystery-2', slug: 'chroma-fang', rarity: 'Chroma', priceChangedAt: '2026-10-05T00:00:00Z', sampleSize: 37 },
        { gameSlug: 'murder-mystery-2', slug: 'default-knife', rarity: 'Common', priceChangedAt: '2026-10-05T00:00:00Z', sampleSize: 80 },
        { gameSlug: 'murder-mystery-2', slug: 'thin-godly', rarity: 'Godly', priceChangedAt: '2026-10-05T00:00:00Z', sampleSize: 2 },
      ],
    })
    expect(all).toContain(`${BASE}/murder-mystery-2/values`)
    expect(all).toContain(`${BASE}/murder-mystery-2/values/methodology`)
    expect(all).toContain(`${BASE}/murder-mystery-2/values/harvester`)
    expect(all).toContain(`${BASE}/murder-mystery-2/values/chroma-fang`)
    expect(all).not.toContain(`${BASE}/murder-mystery-2/values/default-knife`) // commons: list rows, no page
    expect(all).not.toContain(`${BASE}/murder-mystery-2/values/thin-godly`) // < 3 listings: noindex
    expect(all).not.toContain(`${BASE}/murder-mystery-2/calculator`) // Step 3
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
    expect(lastmod(`${BASE}/steal-a-brainrot/buy-items/sab-item`)).toBe('2026-09-26T09:00:00Z')
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
