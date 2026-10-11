/**
 * Every registered game must satisfy the import contract. This file is the
 * reason adding a game is safe: a new entry in the registry is tested the
 * moment it is registered, without anyone remembering to write a test.
 */
import { describe, it, expect } from 'vitest'
import { importConfigFor, importableGameSlugs } from './index'
import { priceKey } from '../types'
import type { CatalogueItem, ImportReader } from '../types'
import { TITLE_MIN, TITLE_MAX, DESCRIPTION_MAX, DELIVERY_METHODS } from '@/lib/listings/validate'
import { SELLER_DELIVERY_WINDOWS } from '@/lib/utils/delivery-time'

/**
 * Chainable read stub: from(table) resolves to that table's rows. Honours
 * `.range(from, to)` the way PostgREST does, so a loader that forgets to page
 * gets only its first page — which is exactly the bug the paging test pins.
 */
function fakeClient(byTable: Record<string, { data: unknown; error: unknown }>): ImportReader {
  return {
    from(table: string) {
      const res = byTable[table] ?? { data: [], error: null }
      let window: [number, number] | null = null
      const b: any = {}
      for (const m of ['select', 'eq', 'in', 'order', 'is', 'not', 'limit']) b[m] = () => b
      b.range = (from: number, to: number) => {
        window = [from, to]
        return b
      }
      b.then = (ok: any, ko: any) => {
        const rows = Array.isArray(res.data) ? res.data : null
        // An unranged read still stops at PostgREST's 1,000-row cap.
        const [from, to] = window ?? [0, 999]
        const data = rows ? rows.slice(from, Math.min(to, from + 999) + 1) : res.data
        return Promise.resolve({ data, error: res.error }).then(ok, ko)
      }
      return b
    },
  }
}

const SAMPLE_ITEM: CatalogueItem = {
  ref: 'shadow-dragon',
  name: 'Shadow Dragon',
  aliases: [],
  facts: { rarity: 'legendary', obtainedFrom: 'Halloween Event 2019', incomePerSec: 1500, area: 'jungle' },
  imageUrl: null,
}

const WINDOW_VALUES: Set<string> = new Set(SELLER_DELIVERY_WINDOWS.map((w) => w.value))
/** Copy the hub guard bans; listing descriptions are held to the same line. */
const BANNED_COPY = [/\bescrow\b/i, /we hold (your )?funds/i, /funds are held/i, /holding funds/i, /paid on delivery/i, /paid only after/i, /paid out only after/i]

describe.each(importableGameSlugs())('import contract — %s', (slug) => {
  const config = importConfigFor(slug)!

  it('is registered under its own gameSlug', () => {
    expect(config.gameSlug).toBe(slug)
  })

  it('targets a category the publish gate understands', () => {
    // findEnabledGameCategory takes a GLOBAL category slug, not a pair slug.
    expect(['items', 'accounts', 'currency', 'top-up']).toContain(config.categorySlug)
  })

  it('promises a delivery window the shared validator accepts', () => {
    expect(DELIVERY_METHODS).toContain(config.delivery.method)
    expect(WINDOW_VALUES.has(config.delivery.window), `window ${config.delivery.window}`).toBe(true)
  })

  it('names its item noun, and its variant noun only if it has variants', () => {
    expect(config.itemNoun.length).toBeGreaterThan(0)
    expect(config.variantNoun === null || config.variantNoun.length > 0).toBe(true)
  })

  it('has a placeholder image for items with no art', () => {
    expect(config.placeholderImage).toMatch(/^\//)
  })

  describe('generated copy', () => {
    const variant = config.variantNoun ? { ref: 'X', label: 'Test Variant' } : null
    const ctx = { item: SAMPLE_ITEM, variant, gameName: slug }

    it('produces a title within the column limits', () => {
      const t = config.title(ctx)
      expect(t.length).toBeGreaterThanOrEqual(TITLE_MIN)
      expect(t.length).toBeLessThanOrEqual(TITLE_MAX)
      expect(t).toContain('Shadow Dragon')
    })

    it('keeps the title within limits for an absurdly long item name', () => {
      const t = config.title({ ...ctx, item: { ...SAMPLE_ITEM, name: 'Q'.repeat(300) } })
      expect(t.length).toBeLessThanOrEqual(TITLE_MAX)
    })

    it('produces a description within the column limit', () => {
      const d = config.description(ctx)
      expect(d.length).toBeGreaterThan(0)
      expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
    })

    it('states the delivery window it promises', () => {
      expect(config.description(ctx).toLowerCase()).toContain(
        (SELLER_DELIVERY_WINDOWS.find((w) => w.value === config.delivery.window)?.label ?? '').toLowerCase(),
      )
    })

    it('never uses payout-timing or custody language', () => {
      const text = `${config.title(ctx)} ${config.description(ctx)}`
      for (const re of BANNED_COPY) expect(text, String(re)).not.toMatch(re)
    })

    it('invents no facts for an item the catalogue knows nothing about', () => {
      const bare = { ...SAMPLE_ITEM, facts: {} }
      const d = config.description({ ...ctx, item: bare })
      expect(d).not.toMatch(/unknown|n\/a|undefined|null/i)
      expect(d).not.toMatch(/Rarity:/)
    })
  })

  it('surfaces a loader failure instead of silently importing an empty catalogue', async () => {
    const broken = fakeClient({
      adopt_me_pets: { data: null, error: { message: 'boom' } },
      sab_brainrots: { data: null, error: { message: 'boom' } },
      values_items: { data: null, error: { message: 'boom' } },
    })
    await expect(config.loadCatalogue(broken, 'game-1')).rejects.toThrow(/boom/)
  })
})

describe('adopt-me loaders', () => {
  const config = importConfigFor('adopt-me')!

  it('maps pets to catalogue items and the eight variants', async () => {
    const client = fakeClient({
      adopt_me_pets: {
        data: [{ slug: 'shadow-dragon', name: 'Shadow Dragon', rarity: 'legendary', origin_type: 'event', origin_detail: 'Halloween Event 2019', image_url: 'https://x.test/sd.png' }],
        error: null,
      },
    })
    const cat = await config.loadCatalogue(client, 'game-1')
    expect(cat.items).toEqual([{
      ref: 'shadow-dragon',
      name: 'Shadow Dragon',
      aliases: [],
      facts: { rarity: 'legendary', obtainedFrom: 'Halloween Event 2019' },
      imageUrl: 'https://x.test/sd.png',
    }])
    expect(cat.variants.map((v) => v.ref)).toEqual(['N', 'F', 'R', 'FR', 'NEON', 'NFR', 'MEGA', 'MFR'])
    expect(cat.variants.find((v) => v.ref === 'NFR')?.label).toBe('Neon Fly Ride')
  })

  it('falls back to the coarse origin when there is no specific one, and says nothing when neither exists', async () => {
    const client = fakeClient({
      adopt_me_pets: {
        data: [
          { slug: 'a', name: 'A', rarity: null, origin_type: 'egg', origin_detail: null, image_url: null },
          { slug: 'b', name: 'B', rarity: null, origin_type: null, origin_detail: null, image_url: null },
        ],
        error: null,
      },
    })
    const cat = await config.loadCatalogue(client, 'game-1')
    expect(cat.items[0].facts.obtainedFrom).toBe('egg')
    expect(cat.items[1].facts.obtainedFrom).toBeNull()
  })

  it('keys prices by (pet slug, variant) and flags derived values as estimated', async () => {
    const client = fakeClient({
      adopt_me_pet_values: {
        data: [
          { variant: 'NFR', cheapest_usd: 12.5, average_usd: 14, is_estimated: false, listings_tracked: 7, adopt_me_pets: { slug: 'shadow-dragon' } },
          { variant: 'N', cheapest_usd: null, average_usd: 3, is_estimated: true, listings_tracked: 0, adopt_me_pets: { slug: 'shadow-dragon' } },
          { variant: 'FR', cheapest_usd: 0, average_usd: null, is_estimated: false, listings_tracked: 0, adopt_me_pets: { slug: 'shadow-dragon' } },
        ],
        error: null,
      },
    })
    const prices = await config.loadMarketPrices(client, 'game-1')
    // cheapest wins over average
    expect(prices.get(priceKey('shadow-dragon', 'NFR'))).toEqual({ usd: 12.5, estimated: false, sampleSize: 7 })
    // falls back to average, and carries the estimated flag
    expect(prices.get(priceKey('shadow-dragon', 'N'))).toEqual({ usd: 3, estimated: true, sampleSize: 0 })
    // a zero / missing price is not a price
    expect(prices.has(priceKey('shadow-dragon', 'FR'))).toBe(false)
  })
})

describe('loaders read every row, not just the first 1,000', () => {
  // Reproduces 2026-10-10: 4,016 Adopt Me value rows, and Panda / Kangaroo /
  // Giraffe / SSBD — all with live prices — came back "no market price"
  // because the read stopped at PostgREST's 1,000-row cap.
  const filler = (n: number, offset = 0) =>
    Array.from({ length: n }, (_, j) => j + offset).map((i) => ({
      variant: 'FR', cheapest_usd: 1, average_usd: 1, is_estimated: false, listings_tracked: 1,
      adopt_me_pets: { slug: `filler-${i}` },
    }))

  it('finds an Adopt Me price stored past row 1,000', async () => {
    const rows = [
      ...filler(2400),
      { variant: 'FR', cheapest_usd: 1.1, average_usd: 1.2, is_estimated: false, listings_tracked: 13, adopt_me_pets: { slug: 'panda' } },
      ...filler(1600, 2400),
    ]
    const prices = await importConfigFor('adopt-me')!.loadMarketPrices(
      fakeClient({ adopt_me_pet_values: { data: rows, error: null } }),
      'game-1',
    )
    expect(prices.size).toBe(4001)
    expect(prices.get(priceKey('panda', 'FR'))?.usd).toBe(1.1)
  })

  it('finds a Steal a Brainrot price stored past row 1,000', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({
      brainrot_slug: `b-${i}`, mutation_slug: 'gold', cheapest_usd: 2, market_value_usd: 2,
      is_public_estimate: false, external_sample_size: 3,
    }))
    const prices = await importConfigFor('steal-a-brainrot')!.loadMarketPrices(
      fakeClient({ sab_price_display: { data: rows, error: null } }),
      'game-1',
    )
    expect(prices.size).toBe(1500)
    expect(prices.has(priceKey('b-1499', 'gold'))).toBe(true)
  })

  it('reads a catalogue past 1,000 items', async () => {
    const pets = Array.from({ length: 1234 }, (_, i) => ({
      slug: `pet-${i}`, name: `Pet ${i}`, rarity: null, origin_type: null, origin_detail: null, image_url: null,
    }))
    const cat = await importConfigFor('adopt-me')!.loadCatalogue(
      fakeClient({ adopt_me_pets: { data: pets, error: null } }),
      'game-1',
    )
    expect(cat.items).toHaveLength(1234)
  })
})

describe('steal-a-brainrot loaders', () => {
  const config = importConfigFor('steal-a-brainrot')!

  it('merges both alias sources and hides un-approved art', async () => {
    const client = fakeClient({
      sab_brainrots: {
        data: [
          { id: 'b1', slug: 'tralalero', name: 'Tralalero Tralala', rarity: 'secret', aliases: ['tralalelo'], base_income_per_second: 2500, acquisition_method: 'Shop', obtainability: null, image_path: 'a.webp', image_status: 'approved' },
          { id: 'b2', slug: 'pending-art', name: 'Pending Art', rarity: null, aliases: null, base_income_per_second: null, acquisition_method: null, obtainability: null, image_path: 'b.webp', image_status: 'pending' },
        ],
        error: null,
      },
      sab_brainrot_aliases: { data: [{ brainrot_id: 'b1', alias: 'trala' }], error: null },
      sab_mutations: { data: [{ slug: 'gold', name: 'Gold' }], error: null },
    })
    const cat = await config.loadCatalogue(client, 'game-1')
    expect(cat.items[0].aliases).toEqual(['tralalelo', 'trala'])
    expect(cat.items[0].facts.incomePerSec).toBe(2500)
    // un-approved art is not put on a listing
    expect(cat.items[1].imageUrl).toBeNull()
    expect(cat.variants).toEqual([{ ref: 'gold', label: 'Gold', note: null }])
  })

  it("explains a mutation with the game's own income multiplier, and says nothing when it is neutral", async () => {
    const client = fakeClient({
      sab_brainrots: { data: [], error: null },
      sab_brainrot_aliases: { data: [], error: null },
      sab_mutations: {
        data: [
          { slug: 'gold', name: 'Gold', income_multiplier: 1.25 },
          { slug: 'rainbow', name: 'Rainbow', income_multiplier: 10 },
          { slug: 'none', name: 'Normal', income_multiplier: 1 },
          { slug: 'odd', name: 'Odd', income_multiplier: null },
        ],
        error: null,
      },
    })
    const { variants } = await config.loadCatalogue(client, 'game-1')
    expect(variants.map((v) => v.note)).toEqual([
      'Gold mutation: earns 1.25× the base income.',
      'Rainbow mutation: earns 10× the base income.',
      null,
      null,
    ])
  })

  it('keys prices by (brainrot, mutation) and treats a null mutation as no variant', async () => {
    const client = fakeClient({
      sab_price_display: {
        data: [
          { brainrot_slug: 'tralalero', mutation_slug: 'gold', cheapest_usd: 9, market_value_usd: 11, is_public_estimate: false, external_sample_size: 4 },
          { brainrot_slug: 'tralalero', mutation_slug: null, cheapest_usd: 5, market_value_usd: 6, is_public_estimate: true, external_sample_size: 1 },
        ],
        error: null,
      },
    })
    const prices = await config.loadMarketPrices(client, 'game-1')
    expect(prices.get(priceKey('tralalero', 'gold'))?.usd).toBe(9)
    expect(prices.get(priceKey('tralalero', null))).toEqual({ usd: 5, estimated: true, sampleSize: 1 })
  })
})

describe('steal-an-egg loaders', () => {
  const config = importConfigFor('steal-an-egg')!

  it('has no variant axis — the market sells sealed random eggs', async () => {
    const client = fakeClient({
      values_items: { data: [{ id: 'i1', slug: 'jungle-egg', name: 'Jungle Egg', kind: 'egg', rarity: 'rare', area: 'jungle', income_per_sec: null, image_url: null }], error: null },
      values_item_aliases: { data: [{ item_id: 'i1', alias: 'jungle' }], error: null },
    })
    const cat = await config.loadCatalogue(client, 'game-1')
    expect(cat.variants).toEqual([])
    expect(cat.items[0].aliases).toEqual(['jungle'])
    expect(cat.items[0].facts.area).toBe('jungle')
  })

  it('leaves out an `area`, which is a grouping rather than something to sell', async () => {
    const client = fakeClient({
      values_items: {
        data: [
          { id: 'i1', slug: 'jungle-egg', name: 'Jungle Egg', kind: 'egg', rarity: null, area: null, income_per_sec: null, image_url: null },
          { id: 'i2', slug: 'jungle', name: 'Jungle', kind: 'area', rarity: null, area: null, income_per_sec: null, image_url: null },
        ],
        error: null,
      },
      values_item_aliases: { data: [], error: null },
    })
    const cat = await config.loadCatalogue(client, 'game-1')
    expect(cat.items.map((i) => i.ref)).toEqual(['jungle-egg'])
  })

  it('says an egg is sealed, because that is the one thing a buyer must know', async () => {
    const d = config.description({
      item: { ref: 'jungle-egg', name: 'Jungle Egg', aliases: [], facts: { kind: 'egg' }, imageUrl: null },
      variant: null,
      gameName: 'Steal An Egg',
    })
    expect(d).toContain('Sold sealed')
  })
})
