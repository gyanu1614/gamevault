import { describe, it, expect } from 'vitest'
import {
  eventLengthDays,
  eventSetValue,
  featuredEvent,
  formatEventDate,
  formatEventRange,
  formatEventUsd,
  formatStartWindow,
  groupByChannel,
  groupEventsByYear,
  isEventIndexable,
  obtainChannel,
  previousSameSeason,
  seasonFilterOf,
  seasonPattern,
  sortEventItems,
  sortEventsNewestFirst,
  type EventItemView,
  type EventView,
} from './events-model'

const item = (over: Partial<EventItemView> = {}): EventItemView => ({
  name: 'Raygun',
  slug: 'raygun',
  rarity: 'Godly',
  itemType: 'gun',
  imageUrl: null,
  how: null,
  cheapestUsd: null,
  marketUsd: null,
  href: null,
  howToGetStatus: null,
  ...over,
})

const ev = (over: Partial<EventView> = {}): EventView => ({
  slug: 'halloween-2025',
  name: 'Halloween 2025',
  season: 'halloween',
  year: 2025,
  status: 'ended',
  startsOn: '2025-10-18',
  endsOn: '2025-11-21',
  currency: 'Candies',
  format: 'mixed',
  summary: 'x',
  howItemsWereObtained: null,
  items: [],
  sources: [],
  checkedAt: '2026-10-05',
  updatedAt: null,
  ...over,
})

describe('set value', () => {
  it('sums the cheapest prices of priced items, to the cent', () => {
    const v = eventSetValue([
      item({ slug: 'a', cheapestUsd: 0.1 }),
      item({ slug: 'b', cheapestUsd: 0.2 }),
      item({ slug: 'c', cheapestUsd: null }),
    ])
    expect(v).toEqual({ totalUsd: 0.3, pricedCount: 2, itemCount: 3 })
  })

  it('counts an item listed twice once', () => {
    const v = eventSetValue([item({ slug: 'a', cheapestUsd: 5 }), item({ slug: 'a', cheapestUsd: 5 })])
    expect(v).toEqual({ totalUsd: 5, pricedCount: 1, itemCount: 1 })
  })

  it('dedupes unmatched items by name and never counts zero or negative prices', () => {
    const v = eventSetValue([
      item({ slug: null, name: 'Laser', cheapestUsd: null }),
      item({ slug: null, name: 'laser' }),
      item({ slug: 'x', cheapestUsd: 0 }),
    ])
    expect(v).toEqual({ totalUsd: null, pricedCount: 0, itemCount: 2 })
  })

  it('is null with no items', () => {
    expect(eventSetValue([])).toEqual({ totalUsd: null, pricedCount: 0, itemCount: 0 })
  })
})

describe('dates', () => {
  it('formats one date and ranges', () => {
    expect(formatEventDate('2025-10-18')).toBe('Oct 18, 2025')
    expect(formatEventDate(null)).toBeNull()
    expect(formatEventRange('2025-10-18', '2025-11-21')).toBe('Oct 18 – Nov 21, 2025')
    expect(formatEventRange('2025-12-14', '2026-01-19')).toBe('Dec 14, 2025 – Jan 19, 2026')
    expect(formatEventRange('2016-03-25', null)).toBe('From Mar 25, 2016')
    expect(formatEventRange(null, '2023-05-03')).toBe('Until May 3, 2023')
    expect(formatEventRange(null, null)).toBeNull()
  })

  it('measures length inclusively, null when a date is missing', () => {
    expect(eventLengthDays('2025-10-18', '2025-11-21')).toBe(35)
    expect(eventLengthDays('2025-10-18', null)).toBeNull()
  })
})

describe('money', () => {
  it('keeps cents under $1,000 and drops them above', () => {
    expect(formatEventUsd(12.3)).toBe('$12.30')
    expect(formatEventUsd(4049.98)).toBe('$4,050')
  })
})

describe('ordering and grouping', () => {
  const list = [
    ev({ slug: 'h24', year: 2024, startsOn: '2024-10-16' }),
    ev({ slug: 'h26', year: 2026, status: 'upcoming', startsOn: null, endsOn: null }),
    ev({ slug: 's26', year: 2026, startsOn: '2026-07-23' }),
    ev({ slug: 'c24', year: 2024, startsOn: '2024-12-20' }),
  ]

  it('sorts newest first, an undated upcoming event leading its year', () => {
    expect(sortEventsNewestFirst(list).map((e) => e.slug)).toEqual(['h26', 's26', 'c24', 'h24'])
  })

  it('groups consecutive events by year', () => {
    const g = groupEventsByYear(sortEventsNewestFirst(list))
    expect(g.map((x) => [x.year, x.events.length])).toEqual([
      [2026, 2],
      [2024, 2],
    ])
  })

  it('features the live event, else the next upcoming one', () => {
    expect(featuredEvent(list)?.slug).toBe('h26')
    expect(featuredEvent([...list, ev({ slug: 'live', status: 'live' })])?.slug).toBe('live')
    expect(featuredEvent([ev()])).toBeNull()
  })

  it('finds earlier ended events of the same season, newest first', () => {
    const all = [
      ev({ slug: 'h26', year: 2026, status: 'upcoming', startsOn: null }),
      ev({ slug: 'h25', year: 2025 }),
      ev({ slug: 'c25', year: 2025, season: 'christmas' }),
      ev({ slug: 'h24', year: 2024, startsOn: '2024-10-16' }),
    ]
    expect(previousSameSeason(all, all[0]).map((e) => e.slug)).toEqual(['h25', 'h24'])
  })

  it('sorts items priced first by price, then by rarity', () => {
    const rank = (r: string | null) => (r === 'Godly' ? 0 : r === 'Rare' ? 1 : 9)
    const out = sortEventItems(
      [
        item({ name: 'C', rarity: 'Rare' }),
        item({ name: 'A', cheapestUsd: 1 }),
        item({ name: 'B', cheapestUsd: 3 }),
        item({ name: 'D', rarity: 'Godly' }),
      ],
      rank,
    )
    expect(out.map((i) => i.name)).toEqual(['B', 'A', 'D', 'C'])
  })

  it('maps seasons onto the four filters plus Other', () => {
    expect(seasonFilterOf('halloween')).toBe('halloween')
    expect(seasonFilterOf('valentines')).toBe('other')
    expect(seasonFilterOf('collab')).toBe('other')
  })
})

describe('obtain channels', () => {
  it.each([
    ['Event pass reward', 'pass'],
    ['Tier 25 reward of the Halloween 2025 battle pass.', 'pass'],
    ['Unboxed from the 2025 Halloween Box', 'box'],
    ['Bought with Robux via the Xenoknife Gamepass (or the Xenotech Bundle)', 'robux'],
    ['Robux purchase: Elite Gamepass bought during the event', 'robux'],
    ['Event leaderboard prize', 'leaderboard'],
    ['Crafted during Christmas 2015 by combining a Heat with 100 Gifts', 'craft'],
    ['Bought in the shop for 75 coins', 'shop'],
    ['Event reward: bingo Challenge', 'tasks'],
    [null, 'other'],
  ] as const)('%s → %s', (how, channel) => {
    expect(obtainChannel(how)).toBe(channel)
  })

  it('groups biggest first with "other" last', () => {
    const g = groupByChannel([
      item({ how: 'Event pass reward' }),
      item({ how: null }),
      item({ how: 'Event pass reward' }),
      item({ how: 'Unboxed from the box' }),
    ])
    expect(g.map((x) => [x.channel, x.items.length])).toEqual([
      ['pass', 2],
      ['box', 1],
      ['other', 1],
    ])
  })
})

describe('season pattern (what to expect)', () => {
  it('reports only ranges the data has', () => {
    const p = seasonPattern([
      ev({ name: 'Halloween 2025', startsOn: '2025-10-18', endsOn: '2025-11-21', items: [item({ slug: 'a' }), item({ slug: 'b' })] }),
      ev({ name: 'Halloween 2024', startsOn: '2024-10-16', endsOn: '2024-12-09', items: [item({ slug: 'a' })] }),
      ev({ name: 'Halloween 2023', startsOn: null, endsOn: '2023-11-21', currency: 'Candy', items: [] }),
    ])
    expect(p.basis).toEqual(['Halloween 2025', 'Halloween 2024', 'Halloween 2023'])
    expect(p.startRange).toEqual({ from: 'Oct 16', to: 'Oct 18' })
    expect(p.lengthDays).toEqual({ min: 35, max: 55 })
    expect(p.currencies).toEqual(['Candies', 'Candy'])
    expect(p.itemCount).toEqual({ min: 1, max: 2 })
    expect(formatStartWindow(p.startRange!)).toBe('Oct 16–18')
    expect(formatStartWindow({ from: 'Sep 30', to: 'Oct 2' })).toBe('Sep 30 – Oct 2')
  })

  it('is empty for no basis', () => {
    expect(seasonPattern([])).toEqual({ basis: [], startRange: null, lengthDays: null, currencies: [], itemCount: null })
  })
})

describe('index rule', () => {
  it('drops only an ended event with no items', () => {
    expect(isEventIndexable({ status: 'ended', itemCount: 0 })).toBe(false)
    expect(isEventIndexable({ status: 'ended', itemCount: 3 })).toBe(true)
    expect(isEventIndexable({ status: 'upcoming', itemCount: 0 })).toBe(true)
  })
})
