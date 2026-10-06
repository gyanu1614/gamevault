import { describe, expect, it } from 'vitest'
import raw from '../../../scripts/values-seeds/murder-mystery-2.boxes.json'
import {
  allBoxes,
  bestCoinBox,
  boxForItem,
  boxView,
  boxSlugs,
  boxTier,
  boxesForEvent,
  coinPrice,
  getBox,
  itemOdds,
  keyDiamonds,
  mysteryKeyDiamonds,
  oddsText,
} from './boxes'
import { roundingNote } from './box-odds'

const G = 'murder-mystery-2'
const box = (slug: string) => {
  const b = getBox(G, slug)
  if (!b) throw new Error(`no box ${slug}`)
  return b
}

describe('the MM2 box seed, typed', () => {
  it('has all 44 boxes: 12 in the Shop (11 weapon boxes + the Common Egg) and 32 retired', () => {
    const all = allBoxes(G)
    expect(all).toHaveLength(44)
    expect(new Set(boxSlugs(G)).size).toBe(44)
    const shop = all.filter((b) => b.inShop)
    expect(shop).toHaveLength(12)
    expect(shop.filter((b) => b.kind === 'egg').map((b) => b.slug)).toEqual(['common-egg'])
    expect(all.filter((b) => !b.inShop)).toHaveLength(32)
  })

  it('keeps every item (639) and 637 catalogue slugs', () => {
    const items = allBoxes(G).flatMap((b) => b.items)
    expect(items).toHaveLength(raw.boxes.reduce((n, b) => n + b.items.length, 0))
    expect(items).toHaveLength(639)
    expect(items.filter((i) => i.slug)).toHaveLength(637)
  })

  it('orders Shop first, then retired event boxes newest first, then the classic boxes', () => {
    const all = allBoxes(G)
    const groups = all.map((b) => b.group)
    expect(groups.indexOf('event')).toBe(12)
    expect(groups.lastIndexOf('shop')).toBe(11)
    expect(groups.indexOf('classic')).toBeGreaterThan(groups.lastIndexOf('event'))
    const events = all.filter((b) => b.group === 'event')
    expect(events[0].slug).toBe('summer-box-2026')
    expect(events[0].year).toBe(2026)
    expect(events.every((b, i) => i === 0 || (events[i - 1].released ?? '') >= (b.released ?? ''))).toBe(true)
  })

  it('unknown games and slugs have nothing', () => {
    expect(allBoxes('adopt-me')).toEqual([])
    expect(getBox(G, 'nope')).toBeNull()
  })
})

describe('odds per box', () => {
  it('a permanent weapon box: 70/15/10/5/0.2 + Chroma 0.004, split evenly', () => {
    const b = box('knife-box-4')
    expect(b.oddsUsable).toBe(true)
    expect(b.tiers.map((t) => [t.rarity, t.pct, t.items.length])).toEqual([
      ['Common', 70, 4],
      ['Uncommon', 15, 3],
      ['Rare', 10, 2],
      ['Legendary', 5, 1],
      ['Godly', 0.2, 1],
      ['Chroma', 0.004, 1],
    ])
    expect(boxTier(b, 'Common')?.perItemPct).toBe(17.5)
    expect(itemOdds(b, { rarity: 'Godly' })).toEqual({ pct: 0.2, basis: 'split' })
    expect(itemOdds(b, { rarity: 'Chroma' })).toEqual({ pct: 0.004, basis: 'split' })
    expect(roundingNote(b.tiers)).toEqual({ total: 100.2, over: 0.2 })
    expect(coinPrice(b)).toBe(1000)
  })

  it('Mystery Box 2: two Godlies and two Chromas, per-item split unconfirmed (never halved)', () => {
    const b = box('mystery-box-2')
    expect(b.splitUnconfirmed).toBe(true)
    expect(b.godlies.map((g) => g.slug)).toEqual(['lightbringer', 'darkbringer'])
    expect(boxTier(b, 'Godly')).toMatchObject({ pct: 0.2, perItemPct: null, perItemBasis: 'unconfirmed' })
    expect(boxTier(b, 'Chroma')).toMatchObject({ pct: 0.004, perItemPct: null, perItemBasis: 'unconfirmed' })
    // The lower tiers still follow the in-game rule.
    expect(boxTier(b, 'Common')?.perItemPct).toBe(17.5)
  })

  it('Common Egg: the in-game per-item figures, and one shared Chroma line', () => {
    const b = box('common-egg')
    expect(b.kind).toBe('egg')
    expect(b.sharedChromaLine).toBe(true)
    expect(boxTier(b, 'Common')).toMatchObject({ pct: 70, perItemBasis: 'stated' })
    expect(boxTier(b, 'Common')?.perItemPct).toBeCloseTo(70 / 3, 10) // shown in-game as 23.33%
    expect(boxTier(b, 'Godly')).toMatchObject({ pct: 0.2, perItemBasis: 'stated' })
    expect(boxTier(b, 'Godly')?.perItemPct).toBeCloseTo(0.2 / 7, 10) // shown in-game as 0.029%
    const chroma = boxTier(b, 'Chroma')!
    expect(chroma.items).toHaveLength(7)
    expect(chroma.perItemBasis).toBe('shared')
    expect(chroma.perItemPct).toBeCloseTo(0.004 / 7, 10)
    expect(b.prices.map((p) => p.unit)).toEqual(['Coins', 'Diamonds'])
  })

  it("Valentine's and Summer 2026 use 70/18/8/4/0.2", () => {
    for (const slug of ['valentines-box-2026', 'summer-box-2026']) {
      expect(box(slug).tiers.slice(0, 5).map((t) => t.pct)).toEqual([70, 18, 8, 4, 0.2])
    }
    expect(boxTier(box('summer-box-2026'), 'Uncommon')).toMatchObject({ perItemPct: 6, perItemBasis: 'stated' })
    // Valentine's Chroma is only "<0.1%" on the wiki: text, no number.
    expect(boxTier(box('valentines-box-2026'), 'Chroma')).toMatchObject({ pct: null, text: '<0.1%', perItemPct: null })
  })

  it('old event boxes keep the wiki estimate as text, never as a number', () => {
    const godly = boxTier(box('christmas-box-2019'), 'Godly')!
    expect(godly).toMatchObject({ pct: null, text: '<1%*', perItemPct: null, perItemBasis: 'none' })
    expect(box('christmas-box-2019').oddsBasis).toBe('wiki')
  })

  it('classic pre-Season 1 boxes whose figures do not add up are item lists only', () => {
    for (const slug of ['uncommon-box', 'legendary-box', 'mlg-box', 'christmas-knife-box-2015']) {
      const b = box(slug)
      expect(b.oddsUsable, slug).toBe(false)
      expect(b.tiers.every((t) => t.pct == null && t.perItemPct == null), slug).toBe(true)
    }
    expect(box('rare-box').oddsUsable).toBe(false) // low-confidence classic: README point 6
    expect(box('pet-box').oddsUsable).toBe(true) // medium-confidence, 60/25/10/5 adds up
  })

  it('the odds basis: in-game for high confidence, wiki otherwise, none without figures', () => {
    expect(box('gun-box-1').oddsBasis).toBe('game')
    expect(box('halloween-box-2024').oddsBasis).toBe('wiki')
    expect(box('mlg-box').oddsBasis).toBe('none')
  })
})

describe('links', () => {
  it('an item links to a Shop box first, else its newest event box', () => {
    expect(boxForItem(G, 'gemstone')?.slug).toBe('mystery-box-1')
    expect(boxForItem(G, 'lightbringer')?.slug).toBe('mystery-box-2')
    expect(boxForItem(G, 'fire-cat')?.slug).toBe('common-egg')
    expect(boxForItem(G, 'not-an-item')).toBeNull()
  })

  it('an event has its box (2015 Christmas has two)', () => {
    expect(boxesForEvent(G, 'halloween-2025').map((b) => b.slug)).toEqual(['halloween-box-2025'])
    expect(boxesForEvent(G, 'christmas-2015').map((b) => b.slug).sort()).toEqual([
      'christmas-gun-box-2015',
      'christmas-knife-box-2015',
    ])
    expect(boxesForEvent(G, 'easter-2025')).toEqual([])
  })
})

describe('text', () => {
  it('reads the source words', () => {
    expect(oddsText('<1%*')).toBe('Under 1% (Wiki Estimate)')
    expect(oddsText('1%*')).toBe('About 1% (Wiki Estimate)')
    expect(oddsText('<0.1%')).toBe('Under 0.1%')
    expect(oddsText('<0.2%*')).toBe('Under 0.2% (Wiki Estimate)')
    expect(oddsText('0.2%?')).toBe('Unconfirmed')
    expect(oddsText('???')).toBe('Not Published')
    expect(oddsText('not given')).toBe('Not Published')
    expect(oddsText(null)).toBe('Not Published')
  })

  it('the Mystery Key price comes from the seed note', () => {
    expect(mysteryKeyDiamonds(G)).toBe(125)
    expect(keyDiamonds('no number here')).toBeNull()
  })
})

describe('a box joined to live prices', () => {
  const prices: Record<string, { cheapestUsd: number | null }> = {
    // knife-box-4: 4 Commons, 3 Uncommons, 2 Rares, 1 Legendary, 1 Godly, 1 Chroma
  }
  const lookupAll = (usd: number | null) => (slug: string) => ({
    cheapestUsd: prices[slug]?.cheapestUsd ?? usd,
    marketUsd: null,
    imageUrl: `https://img/${slug}.png`,
    href: `/murder-mystery-2/values/${slug}`,
  })

  it('EV = Σ tier% × tier average, with the odds as shown', () => {
    const v = boxView(box('knife-box-4'), lookupAll(1))
    expect(v.ev?.usd).toBeCloseTo(1.00204, 10)
    expect(v.items[0].rarity).toBe('Chroma')
    expect(v.items[v.items.length - 1].rarity).toBe('Common')
    expect(v.godly?.slug).toBe(box('knife-box-4').godlies[0].slug)
    expect(v.art).toBe(`https://img/${v.godly?.slug}.png`)
    expect(v.items.find((i) => i.rarity === 'Common')).toMatchObject({ pct: 17.5, basis: 'split' })
  })

  it('no EV when a tier is unpriced, or for a box without usable odds', () => {
    expect(boxView(box('knife-box-4'), lookupAll(null)).ev).toBeNull()
    expect(boxView(box('uncommon-box'), lookupAll(1)).ev).toBeNull()
    expect(boxView(box('christmas-box-2019'), lookupAll(1)).ev).toBeNull() // Godly "<1%*"
  })

  it('picks the priciest Godly for art and the cheapest priced one to buy', () => {
    const p: Record<string, number> = { lightbringer: 1.2, darkbringer: 1.04 }
    const v = boxView(box('mystery-box-2'), (slug) => ({ cheapestUsd: p[slug] ?? 0.1, marketUsd: null, imageUrl: null, href: null }))
    expect(v.godly?.slug).toBe('lightbringer')
    expect(v.cheapestGodly?.slug).toBe('darkbringer')
    expect(v.items.filter((i) => i.rarity === 'Godly').every((i) => i.pct === null && i.basis === 'unconfirmed')).toBe(true)
  })

  it('the best 1,000-Coin box is the Shop box with the highest EV', () => {
    const views = allBoxes(G).map((b) =>
      boxView(b, (slug) => ({ cheapestUsd: slug === 'gemstone' ? 50 : 0.2, marketUsd: null, imageUrl: null, href: null })),
    )
    expect(bestCoinBox(views)?.box.slug).toBe('mystery-box-1')
    expect(bestCoinBox([])).toBeNull()
  })
})
