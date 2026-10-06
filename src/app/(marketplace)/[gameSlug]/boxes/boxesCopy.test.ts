import { describe, expect, it } from 'vitest'
import { allBoxes, boxView, getBox, type BoxView, type PricedItem } from '@/lib/values/boxes'
import {
  bestCallout,
  boxAnswer,
  boxFacts,
  boxFaq,
  boxH1,
  boxMetaTitle,
  buyRow,
  chanceCell,
  dateRange,
  eachItemCell,
  eggCallout,
  endedRow,
  evCallout,
  hubFaq,
  hubH1,
  hubLead,
  hubMetaDescription,
  itemOddsLine,
  ladderSteps,
  mysteryBox2Callout,
  oddsTableNote,
  priceList,
  retiredCallout,
  roundingCallout,
  unboxRow,
  type ShopOdds,
} from './_boxesCopy'

const G = 'murder-mystery-2'
const ctx = { gameName: 'Murder Mystery 2', shortName: 'MM2' }
const o: ShopOdds = { godlyPct: 0.2, chromaPct: 0.004, spinCoins: 1000, coinsPerRound: 40, keyDiamonds: 125 }

/** Every item priced at $1 except the named ones. */
const priced = (over: Record<string, number | null> = {}) => (slug: string): PricedItem => ({
  cheapestUsd: slug in over ? over[slug] : 1,
  marketUsd: null,
  imageUrl: null,
  href: null,
})
const view = (slug: string, over: Record<string, number | null> = {}): BoxView => boxView(getBox(G, slug)!, priced(over))

describe('the hub', () => {
  it('H1 and meta carry the search and the real odds', () => {
    expect(hubH1(ctx)).toBe("MM2 Box Odds: Every Murder Mystery 2 Box, Drop Rates and What's Inside")
    const d = hubMetaDescription(ctx, o, 12, 32)
    expect(d).toContain('a Godly is 0.2% a spin (1 in 500)')
    expect(d).toContain('a Chroma 0.004% (1 in 25,000)')
    expect(d).toContain('12 boxes in the Shop now, 32 retired')
  })

  it('the lead answers first: 0.2% / 0.004%, ~500 / ~25,000 spins, 50% by 347', () => {
    const l = hubLead(ctx, o, 32)
    expect(l.strong).toBe('A Godly is a 0.2% chance per spin in every MM2 Shop box, and a Chroma is 0.004%.')
    expect(l.rest).toContain('~500 spins for a Godly on average (50% chance by 347)')
    expect(l.rest).toContain('~25,000 for a Chroma')
    expect(l.rest).toContain('all 32 retired boxes')
  })

  it('the ladder of a standard box: 4 / 3 / 2 / 1 items and the rare tiers in spins', () => {
    expect(ladderSteps(getBox(G, 'knife-box-4')!)).toEqual([
      { rarity: 'Common', title: 'Common 70%', value: '4 items · 17.5% each' },
      { rarity: 'Uncommon', title: 'Uncommon 15%', value: '3 items · 5% each' },
      { rarity: 'Rare', title: 'Rare 10%', value: '2 items · 5% each' },
      { rarity: 'Legendary', title: 'Legendary 5%', value: '1 item' },
      { rarity: 'Godly', title: 'Godly 0.2%', value: '~500 spins on average' },
      { rarity: 'Chroma', title: 'Chroma 0.004%', value: '~25,000 spins on average' },
    ])
  })

  it('the three notes: 100.2% rounding, Mystery Box 2, Common Egg', () => {
    expect(roundingCallout(getBox(G, 'knife-box-4')!)).toEqual({
      title: 'Why 100.2%?',
      body: "the game's own screen shows 70 + 15 + 10 + 5 + 0.2 = 100.2%, plus 0.004% Chroma: rounded display figures, used here exactly as shown",
    })
    expect(mysteryBox2Callout(getBox(G, 'mystery-box-2')!)?.body).toContain('Lightbringer and Darkbringer')
    expect(mysteryBox2Callout(getBox(G, 'mystery-box-2')!)?.body).toContain('no per-item rate is given')
    expect(mysteryBox2Callout(getBox(G, 'knife-box-4')!)).toBeNull()
    const egg = eggCallout(getBox(G, 'common-egg')!)!
    expect(egg.body).toContain('7 Fire pets (0.029% each, ~3,500 hatches for one)')
    expect(egg.body).toContain('one 0.004% Chroma line covers all 7 Chroma Fire pets')
  })

  it('the best-box callout names the box and its EV', () => {
    const best = view('mystery-box-1', { gemstone: 0.57 })
    const c = bestCallout(ctx, best, 12)
    expect(c.title).toBe(`Expected Value per 1,000-Coin Spin ≈ $${best.ev!.usd.toFixed(2)}`)
    expect(c.body).toBe('Mystery Box 1 is the best of the 12 MM2 Shop boxes at today\'s prices; its Godly, Gemstone, sells for $0.57')
  })

  it('the FAQ uses the same figures, and the spin price from the box', () => {
    const qa = hubFaq(ctx, o, {
      best: view('mystery-box-1'),
      shopCount: 12,
      retiredCount: 32,
      rounding: { total: 100.2 },
      egg: getBox(G, 'common-egg'),
      spinPrice: getBox(G, 'knife-box-4')!.prices,
    })
    const a = (q: RegExp) => qa.find((x) => q.test(x.q))?.a
    expect(a(/Godly in MM2/)).toContain('0.2% per spin')
    expect(a(/Godly in MM2/)).toContain('50% chance by 347 spins')
    expect(a(/Chroma odds/)).toContain('50% chance by 17,329 spins')
    expect(a(/cost/)).toBe(
      '1,000 Coins, 100 Diamonds or 1 Mystery Key per spin. A Mystery Key costs 125 Diamonds in the Shop, so paying 100 Diamonds directly is cheaper. At 40 Coins a round, one spin is 25 full-bag rounds.',
    )
    expect(a(/100\.2%/)).toContain('rounded display figures')
    expect(a(/Common Egg/)).toContain('0.029% each')
    expect(a(/still open/)).toBe('No. 32 boxes have left the Shop; their items are trade-only now.')
  })
})

describe('one box', () => {
  it('H1s target the search', () => {
    expect(boxH1(ctx, getBox(G, 'knife-box-4')!)).toBe('MM2 Knife Box 4: Drop Rates and Every Item Inside')
    expect(boxH1(ctx, getBox(G, 'common-egg')!)).toBe('MM2 Common Egg: Hatch Rates and Every Pet Inside')
    expect(boxMetaTitle(ctx, getBox(G, 'knife-box-4')!)).toBe('MM2 Knife Box 4 Odds: Drop Rates, Items and Value')
  })

  it('a Shop box answers with its Godly, Chroma, price and value per spin', () => {
    const v = view('knife-box-4')
    const g = v.box.godlies[0].name
    const a = boxAnswer(ctx, v, null)
    expect(a.strong).toBe(`Knife Box 4 gives its Godly, ${g}, at 0.2% a spin: 1 in 500.`)
    expect(a.rest).toContain('A spin costs 1,000 Coins, 100 Diamonds or 1 Mystery Key.')
    expect(a.rest).toContain(`Its Chroma, ${v.box.chromas[0].name}, is 0.004% (1 in 25,000).`)
    expect(a.rest).toContain('returns ≈ $1.00 of items on average')
  })

  it('Mystery Box 2 states the tier, not a per-Godly figure; the egg says hatch', () => {
    expect(boxAnswer(ctx, view('mystery-box-2'), null).strong).toBe(
      'Mystery Box 2 holds two Godlies, Lightbringer and Darkbringer: together 0.2% a spin, 1 in 500.',
    )
    const egg = boxAnswer(ctx, view('common-egg'), null)
    expect(egg.strong).toBe('The Common Egg hatches a Godly Fire pet at 0.2% (1 in 500), split across 7 pets.')
    expect(egg.rest).toContain('A hatch costs 1,000 Coins or 100 Diamonds.')
  })

  it('a retired box says clearly it is trade-only, with its event and dates', () => {
    const v = view('halloween-box-2025', { 'not-a-slug': null })
    const a = boxAnswer(ctx, v, 'Halloween 2025')
    expect(a.strong).toBe('2025 Halloween Box is no longer in the MM2 Shop, so its items are trade-only now.')
    expect(a.rest).toContain('It came with the Halloween 2025 event (Oct 18 – Nov 21, 2025) and cost 800 Candies or 1 Alien Key a spin.')
    expect(a.rest).toContain('was a 0.2% drop and sells for $1.00 today')
    expect(retiredCallout(ctx, v, 'Halloween 2025')).toEqual({
      title: 'No Longer in the Shop',
      body: '2025 Halloween Box left with the Halloween 2025 event on Nov 21, 2025; its 12 items are trade-only in MM2 now',
    })
    expect(endedRow(ctx, v, 'Halloween 2025')?.body).toBe(
      '2025 Halloween Box left the Murder Mystery 2 Shop when the Halloween 2025 event ended on Nov 21, 2025. The only way to get its items now is a trade.',
    )
    expect(evCallout(v)).toBeNull()
    expect(unboxRow(v, 40)).toBeNull()
  })

  it('an old box keeps the wiki words; a classic one says its odds do not add up', () => {
    expect(boxAnswer(ctx, view('christmas-box-2019'), 'Christmas 2019').rest).toContain('listed at under 1% (wiki estimate)')
    expect(boxAnswer(ctx, view('uncommon-box'), null).rest).toContain('Its old drop rates do not add up, so only its items are listed.')
  })

  it('facts: price + rounds, Godly and Chroma as % and 1 in N, value per spin', () => {
    expect(boxFacts(view('knife-box-4'), 40)).toEqual([
      { label: 'Price Per Spin', value: '1,000 Coins · 25 Rounds' },
      { label: 'Godly Chance', value: '0.2% · 1 in 500' },
      { label: 'Chroma Chance', value: '0.004% · 1 in 25,000' },
      { label: 'Value Per Spin', value: '≈ $1.00' },
    ])
    expect(boxFacts(view('halloween-box-2025'), 40)).toEqual([
      { label: 'Was Sold For', value: '800 Candies or 1 Alien Key' },
      { label: 'In the Shop', value: 'Oct 18 – Nov 21, 2025' },
      { label: 'Godly Chance', value: '0.2% · 1 in 500' },
      { label: 'Items Inside', value: '12 Items' },
    ])
  })

  it('the odds table: chance, each item, unconfirmed and shared lines', () => {
    const mb2 = getBox(G, 'mystery-box-2')!
    const godly = mb2.tiers.find((t) => t.rarity === 'Godly')!
    expect(chanceCell(godly, true)).toBe('0.2%')
    expect(eachItemCell(godly)).toBe('Unconfirmed')
    const egg = getBox(G, 'common-egg')!
    expect(eachItemCell(egg.tiers.find((t) => t.rarity === 'Chroma')!)).toBe('0.00057% (Shared Line)')
    expect(eachItemCell(egg.tiers.find((t) => t.rarity === 'Common')!)).toBe('23.33%')
    const old = getBox(G, 'christmas-box-2019')!.tiers.find((t) => t.rarity === 'Godly')!
    expect(chanceCell(old, true)).toBe('Under 1% (Wiki Estimate)')
    expect(chanceCell(old, false)).toBe('Not Reliable')
  })

  it('one note per odds table, most specific first', () => {
    expect(oddsTableNote(getBox(G, 'mystery-box-2')!)?.title).toBe('Mystery Box 2')
    expect(oddsTableNote(getBox(G, 'common-egg')!)?.title).toBe('Common Egg')
    expect(oddsTableNote(getBox(G, 'knife-box-4')!)?.title).toBe('Why 100.2%?')
    expect(oddsTableNote(getBox(G, 'halloween-box-2024')!)?.title).toBe('Wiki Figures')
    expect(oddsTableNote(getBox(G, 'uncommon-box')!)?.title).toBe('Old Figures')
  })

  it('item odds lines', () => {
    expect(itemOddsLine({ pct: 17.5, basis: 'split' }, { kind: 'box', oddsUsable: true })).toBe('17.5% a Spin')
    expect(itemOddsLine({ pct: 0.029, basis: 'stated' }, { kind: 'egg', oddsUsable: true })).toBe('0.029% a Hatch')
    expect(itemOddsLine({ pct: null, basis: 'unconfirmed' }, { kind: 'box', oddsUsable: true })).toBe('Rate Unconfirmed')
    expect(itemOddsLine({ pct: null, basis: 'none' }, { kind: 'box', oddsUsable: false })).toBe('Old Odds Unreliable')
  })

  it('the unbox maths: cost, value back, ~spins and the 50%-by figure, and the coin total', () => {
    const u = unboxRow(view('knife-box-4'), 40)!
    expect(u.heading).toBe('Unbox It: ~500 Spins for a Godly')
    expect(u.steps).toEqual([
      { icon: 'coins', title: '1,000 Coins a Spin', value: '25 full-bag rounds at 40 Coins' },
      { icon: 'value', title: '≈ $1.00 Back', value: 'Average item value per spin today' },
      { icon: 'godly', title: '~500 Spins for a Godly', value: '50% chance by 347' },
      { icon: 'chroma', title: '~25,000 Spins for a Chroma', value: '50% chance by 17,329' },
    ])
    expect(u.total).toEqual({
      title: '~500 Spins = 500,000 Coins',
      body: 'about 12,500 full-bag rounds for one Godly, on average, and ≈ $501.02 of items along the way',
    })
  })

  it('Buy It Instead names the cheapest Godly', () => {
    const b = buyRow(ctx, view('mystery-box-2', { lightbringer: 1.2, darkbringer: 1.04 }))!
    expect(b.heading).toBe('Buy Darkbringer Instead: $1.04')
    expect(b.cta).toBe('Buy Darkbringer')
    expect(b.steps[0]).toEqual({ icon: 'store', title: 'Darkbringer From $1.04', value: 'Skip ~500 spins' })
    expect(buyRow(ctx, view('rare-box'))).toBeNull() // no Godly inside
  })

  it('the FAQ repeats the visible answer and adds the key tip for key boxes', () => {
    const v = view('knife-box-4')
    const qa = boxFaq(ctx, v, null, o)
    const a = boxAnswer(ctx, v, null)
    expect(qa[0]).toEqual({ q: 'What are the Knife Box 4 odds in MM2?', a: `${a.strong} ${a.rest}` })
    expect(qa.find((x) => /Mystery Key or Diamonds/.test(x.q))?.a).toContain('a Mystery Key costs 125 Diamonds')
    expect(boxFaq(ctx, view('common-egg'), null, o).some((x) => /Mystery Key/.test(x.q))).toBe(false)
    expect(boxFaq(ctx, view('halloween-box-2025'), 'Halloween 2025', o).find((x) => /still get/.test(x.q))?.a).toMatch(/^No\. /)
  })
})

describe('honest wording on every page', () => {
  it('no box copy talks about winning', () => {
    const all: string[] = []
    for (const b of allBoxes(G)) {
      const v = boxView(b, priced())
      const ans = boxAnswer(ctx, v, 'An Event')
      // Item names ("Lucky", "Winter …") are the game's own: the inside-list answer is skipped.
      const faq = boxFaq(ctx, v, 'An Event', o).filter((x) => !/^What's inside/.test(x.q))
      const names = new RegExp(b.items.map((i) => i.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
      all.push(...[ans.strong, ans.rest, ...faq.flatMap((x) => [x.q, x.a])].map((t) => t.replace(names, '')))
      all.push(...boxFacts(v, 40).map((f) => f.value), oddsTableNote(b)?.body ?? '', unboxRow(v, 40)?.heading ?? '')
    }
    for (const s of all) expect(s).not.toMatch(/\bwin(s|ning)?\b|jackpot|lucky|gambl/i)
  })
})

describe('formats', () => {
  it('prices and date ranges', () => {
    expect(priceList([{ amount: 1000, unit: 'Coins' }])).toBe('1,000 Coins')
    expect(priceList([{ amount: 120, unit: 'Shells' }, { amount: 60, unit: 'Diamonds' }])).toBe('120 Shells or 60 Diamonds')
    expect(dateRange('2025-12-14', '2026-01-19')).toBe('Dec 14, 2025 – Jan 19, 2026')
    expect(dateRange('2014', null)).toBe('2014')
    expect(dateRange(null, '2019-05-25')).toBe('Until May 25, 2019')
    expect(dateRange(null, null)).toBeNull()
  })
})
