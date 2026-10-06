import { describe, expect, it } from 'vitest'
import { chromaStats, unboxMaths, type ChromaEntry, type ChromaSource } from '@/lib/values/chromas'
import {
  buyWay,
  faq,
  fmtPct,
  gridHeading,
  lead,
  listPhrase,
  metaDescription,
  pageTitle,
  unboxWay,
  vsCallout,
  vsLead,
  worthLead,
  type BoxBuy,
} from './_chromasCopy'

const ctx = { gameName: 'Murder Mystery 2', shortName: 'MM2' }
const u = unboxMaths(0.004, 0.2, 40, 7)

const src = (kind: ChromaSource['kind'], label: string): ChromaSource => ({
  kind,
  label,
  eventSlug: kind === 'event' ? 'e' : null,
  oddsPct: null,
  oddsUnconfirmed: false,
})

function e(name: string, price: number | null, base: number | null, kind: ChromaSource['kind'], label: string, itemType = 'knife'): ChromaEntry {
  return {
    slug: name.toLowerCase().replace(/\W+/g, '-'),
    name,
    itemType,
    imageUrl: null,
    cheapestUsd: price,
    marketUsd: null,
    href: null,
    base: base != null ? { slug: 'b', name: 'b', cheapestUsd: base, href: null } : null,
    source: src(kind, label),
  }
}

const ENTRIES = [
  e("Chroma Traveler's Gun", 4045.99, 129.93, 'event', '2023 Halloween Box', 'gun'),
  e('Chroma Evergun', 1300, 83.39, 'event', 'Christmas 2023 Event', 'gun'),
  e('Chroma Luger', 1.95, 0.68, 'box', 'Gun Box 1', 'gun'),
  e('Chroma Saw', 0.83, 0.32, 'box', 'Knife Box 3'),
  e('Chroma Elderwood Blade', 1.33, 1.09, 'event', '2022 Halloween Box'),
  e('Chroma Fire Bunny', 0.28, null, 'egg', 'Common Egg', 'pet'),
]
const s = chromaStats(ENTRIES)
const b: BoxBuy = { weapon: { name: 'Chroma Saw', usd: 0.83 }, pet: { name: 'Chroma Fire Bunny', usd: 0.28 }, range: { min: 0.28, max: 1.95 } }

describe('formatting', () => {
  it('prints percentages without exponents', () => {
    expect(fmtPct(0.004)).toBe('0.004')
    expect(fmtPct(0.004 / 7)).toBe('0.00057')
    expect(fmtPct(0.2)).toBe('0.2')
  })
  it('joins lists in prose', () => {
    expect(listPhrase(['A'])).toBe('A')
    expect(listPhrase(['A', '', 'B', 'C'])).toBe('A, B and C')
  })
})

describe('headline copy', () => {
  it('H1 is the search phrase', () => {
    expect(pageTitle(ctx)).toBe('MM2 Chroma Values: Every Chroma Knife, Gun and Pet: Price and Rarity')
  })

  it('leads with the real numbers: count, the most expensive, the average multiple, the box odds', () => {
    const l = lead(ctx, s, u)
    expect(l.strong).toBe("6 MM2 Chromas have a price today, and the most expensive is Chroma Traveler's Gun at $4,045.99.")
    const avg = (s.averageMultiple ?? 0).toFixed(1)
    expect(l.rest).toBe(
      `On average a Chroma sells for ${avg} times the price of its normal version (5 pairs). From a Shop box, a Chroma is a 0.004% roll: about 25,000 spins on average.`,
    )
    expect(metaDescription(ctx, s, u)).toContain('Box odds: 0.004% (~25,000 spins).')
  })

  it('names the grid by what it holds', () => {
    expect(gridHeading(ctx, s)).toBe('Every MM2 Chroma: 2 Knives, 3 Guns and 1 Pet')
  })
})

describe('is it worth it', () => {
  it('answers with the unbox maths and the real price range', () => {
    expect(worthLead(u, b)).toEqual({
      strong: 'Not by unboxing: a box Chroma takes 25,000 spins (25,000,000 Coins) on average.',
      rest: 'The same Shop box Chromas sell for $0.28 to $1.95.',
    })
  })

  it('shows the unbox steps in numbers and is honest about the egg and Mystery Box 2', () => {
    const w = unboxWay(u, ['Mystery Box 2'])
    expect(w.heading).toBe('Unbox One: 0.004% a Spin, ~25,000 Spins')
    expect(w.steps.map((x) => x.title)).toEqual(['40 Coins a Round', '0.004% per Spin', '~25,000 Spins', '~625,000 Rounds'])
    expect(w.steps[1].value).toBe("50 times rarer than the box's Godly")
    expect(w.steps[2].value).toBe('On average; 50% chance by 17,329')
    expect(w.tip).toEqual({
      title: 'Pets and Mystery Box 2',
      body: "7 Fire pets share the Common Egg's 0.004% (~175,000 hatches for one); Mystery Box 2's rate is unconfirmed",
    })
    expect(unboxWay(unboxMaths(0.004, 0.2, 40, 0), []).tip).toBeNull()
  })

  it('buy way: the cheapest real prices and a specific CTA', () => {
    const w = buyWay(ctx, u, b)
    expect(w.heading).toBe('Or Buy One: Box Chromas From $0.28')
    expect(w.cta).toBe('Buy MM2 Chromas')
    expect(w.steps.map((x) => x.title)).toEqual(['Weapon Chromas From $0.83', 'Pet Chromas From $0.28', 'Delivered in Minutes'])
    expect(w.steps[1].value).toBe('Chroma Fire Bunny, skip ~175,000 hatches')
    expect(w.callout?.title).toBe('~625,000 Rounds or $0.83')
  })
})

describe('chroma vs normal', () => {
  it('compares Shop box and event Chromas from the data', () => {
    const l = vsLead(s)!
    expect(l.rest).toBe(
      `Shop box Chromas average ${s.groups.box.average!.toFixed(1)} times (2 pairs); event Chromas average ${s.groups.event.average!.toFixed(1)} times (3 pairs).`,
    )
    expect(vsCallout(s)?.title).toBe(`×${s.averageMultiple!.toFixed(1)} on Average`)
  })
})

describe('FAQ', () => {
  const byPrice = ENTRIES.filter((x) => x.cheapestUsd != null).sort((a, z) => z.cheapestUsd! - a.cheapestUsd!)
  const qa = faq(ctx, s, u, b, {
    byPrice,
    topGodly: { name: 'Gingerscope', usd: 2500 },
    cheapestChroma: { name: 'Chroma Fire Bunny', usd: 0.28 },
  })

  it('asks what players search', () => {
    expect(qa.map((x) => x.q)).toEqual([
      'What is a Chroma in MM2?',
      'What is the rarest and most expensive Chroma in MM2?',
      'How do you get a Chroma in MM2?',
      'How many spins does it take to get a Chroma in MM2?',
      'Are Chromas worth more than Godlies in MM2?',
    ])
  })

  it('answers with computed facts', () => {
    expect(qa[0].a).toContain('drops 0.004% of the time, 50 times rarer')
    expect(qa[1].a).toContain("The most expensive is Chroma Traveler's Gun at $4,045.99, 31.1 times its normal version ($129.93); it came from the 2023 Halloween Box.")
    expect(qa[1].a).toContain('Next are Chroma Evergun ($1,300.00) and Chroma Luger ($1.95).')
    expect(qa[1].a).toContain('about 0.00057% each (~175,000 hatches on average)')
    expect(qa[2].a).toContain('(3 Chromas come from Shop boxes)')
    expect(qa[3].a).toBe(
      '25,000 spins on average at 0.004% a spin: 25,000,000 Coins, about 625,000 full coin-bag rounds at 40 Coins a round. After 17,329 spins you have a 50% chance.',
    )
    expect(qa[4].a).toContain('all 5 Chromas with a priced normal version sell for more, from 1.2 times (Chroma Elderwood Blade) to 31.1 times (Chroma Traveler\'s Gun).')
    expect(qa[4].a).toContain('Chroma Fire Bunny sells for $0.28, while the most expensive Godly, Gingerscope, sells for $2,500.00.')
  })
})
