import { describe, it, expect } from 'vitest'
import type { EventItemView, EventView } from '@/lib/values/events-model'
import { seasonPattern } from '@/lib/values/events-model'
import {
  buyRow,
  channelStepValue,
  eventAnswer,
  eventFacts,
  eventFaq,
  eventH1,
  expectRows,
  expectSentence,
  formatLabel,
  hubFaq,
  hubLead,
  hubTitle,
  obtainableSentence,
  railTitle,
  setValueCallout,
  upcomingDateLine,
  worthSentence,
} from './_eventsCopy'

const C = { shortName: 'MM2', gameName: 'Murder Mystery 2' }

const item = (over: Partial<EventItemView> = {}): EventItemView => ({
  name: 'Raygun',
  slug: 'raygun',
  rarity: 'Godly',
  itemType: 'gun',
  imageUrl: null,
  how: 'Tier 25 reward of the Halloween 2025 battle pass.',
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
  summary: 'An alien-themed Halloween.',
  howItemsWereObtained: 'Tiers cost 800 Candies.',
  items: [
    item({ slug: 'raygun', name: 'Raygun', cheapestUsd: 12 }),
    item({ slug: 'alienbeam', name: 'Alienbeam', how: 'Unboxed from the 2025 Halloween Box', cheapestUsd: 3.5 }),
    item({ slug: 'candy-knife', name: 'Candy Knife', rarity: 'Common', how: 'Event pass reward', cheapestUsd: null }),
  ],
  sources: [],
  checkedAt: '2026-10-05',
  updatedAt: null,
  ...over,
})

const upcoming = ev({
  slug: 'halloween-2026',
  name: 'Halloween 2026',
  year: 2026,
  status: 'upcoming',
  startsOn: null,
  endsOn: null,
  currency: null,
  format: null,
  summary: 'Not announced yet: as of Oct 5, 2026 MM2 has given no date for Halloween 2026. Last year\'s Halloween event started on Oct 18, 2025.',
  howItemsWereObtained: 'Not announced yet.',
  items: [],
})

describe('H1s are the searches people type', () => {
  it('hub', () => {
    expect(hubTitle(C)).toBe('MM2 Events: Every Murder Mystery 2 Event and Its Items')
  })
  it('ended event', () => {
    expect(eventH1(C, ev())).toBe('MM2 Halloween 2025 Event: Items, Values and How to Get Them')
  })
  it('upcoming event', () => {
    expect(eventH1(C, upcoming)).toBe('MM2 Halloween 2026 Event: Release Date and What to Expect')
  })
  it('a name with a colon gets a dash, not a second colon', () => {
    expect(eventH1(C, ev({ name: 'The Hunt: Roblox 20' }))).toBe(
      'MM2 The Hunt: Roblox 20 Event — Items, Values and How to Get Them',
    )
  })
})

describe('event answer', () => {
  it('leads with when, then items, channels, worth and obtainability', () => {
    const a = eventAnswer(C, ev(), null)
    expect(a.lead).toBe('MM2 Halloween 2025 ran from Oct 18 to Nov 21, 2025.')
    expect(a.body).toBe(
      "An alien-themed Halloween. Its 3 tradeable items cost $15.50 together at today's cheapest prices (2 have a price), led by the Raygun at $12.00. Event items never come back, so they are trade-only now.",
    )
    const one = ev({ items: [item({ slug: 'a', name: 'A', cheapestUsd: 2, howToGetStatus: 'obtainable' }), item({ slug: 'b', name: 'B', cheapestUsd: 1 })] })
    expect(eventAnswer(C, one, null).body).toBe(
      "An alien-themed Halloween. Its 2 tradeable items cost $3.00 together at today's cheapest prices, led by the A at $2.00. 1 item can still be obtained in-game; the rest are trade-only now.",
    )
    expect(eventAnswer(C, ev({ items: [item()] }), null).body).toBe(
      'An alien-themed Halloween. It had 1 tradeable item; none has a market price yet. Event items never come back, so they are trade-only now.',
    )
    expect(eventAnswer(C, ev({ items: [] }), null).body).toBe('An alien-themed Halloween. Halloween 2025 gave out no tradeable MM2 items.')
  })

  it('spans years and states a missing date honestly', () => {
    expect(eventAnswer(C, ev({ startsOn: '2025-12-14', endsOn: '2026-01-19' }), null).lead).toBe(
      'MM2 Halloween 2025 ran from Dec 14, 2025 to Jan 19, 2026.',
    )
    expect(eventAnswer(C, ev({ startsOn: '2016-03-25', endsOn: null }), null).lead).toBe(
      'MM2 Halloween 2025 started on Mar 25, 2016 (no end date on record).',
    )
    expect(eventAnswer(C, ev({ startsOn: null, endsOn: '2023-05-03' }), null).lead).toBe(
      'MM2 Halloween 2025 ended on May 3, 2023 (the exact start date is not settled).',
    )
  })

  it('upcoming: the stored summary, then last year in numbers', () => {
    const a = eventAnswer(C, upcoming, ev())
    expect(a.lead).toBe(upcoming.summary)
    expect(a.body).toBe('Halloween 2025 had 3 items; the 2 with a market price are worth $15.50 together today.')
    const allPriced = ev({ items: [item({ slug: 'a', cheapestUsd: 1 })] })
    expect(eventAnswer(C, upcoming, allPriced).body).toBe("Halloween 2025 had 1 item, worth $1.00 together at today's prices.")
    expect(eventAnswer(C, upcoming, null).body).toBe('')
  })
})

describe('obtainability uses the verified how_to_get status', () => {
  it('none obtainable → trade only', () => {
    expect(obtainableSentence(C, ev())).toMatch(/^Halloween 2025 is over and its items do not come back/)
  })
  it('some obtainable → says which', () => {
    const e = ev({ items: [item({ name: 'Raygun', howToGetStatus: 'obtainable' }), item({ name: 'B' })] })
    expect(obtainableSentence(C, e)).toBe(
      'Halloween 2025 is over: 1 item (Raygun) can still be obtained in-game, and the rest can only be traded for or bought.',
    )
  })
  it('no items / live / upcoming', () => {
    expect(obtainableSentence(C, ev({ items: [] }))).toBe('Halloween 2025 gave out no tradeable MM2 items.')
    expect(obtainableSentence(C, ev({ status: 'live' }))).toMatch(/is live/)
    expect(obtainableSentence(C, upcoming)).toMatch(/has not started/)
  })
})

describe('set value copy', () => {
  it('every item priced', () => {
    const e = ev({ items: [item({ slug: 'a', cheapestUsd: 1 }), item({ slug: 'b', cheapestUsd: 2.25 })] })
    expect(setValueCallout(e)).toEqual({
      title: 'Set Value: $3.25',
      body: 'every item from this event at today’s cheapest prices',
    })
    expect(worthSentence(C, e)).toBe(
      "One of every Halloween 2025 item costs $3.25 at today's cheapest prices; the most valuable is the Raygun at $2.25.",
    )
  })
  it('partly priced says how many', () => {
    expect(setValueCallout(ev())!.body).toBe('the 2 of 3 items with a market price, at today’s cheapest prices')
  })
  it('nothing priced → no callout, no worth line', () => {
    const e = ev({ items: [item()] })
    expect(setValueCallout(e)).toBeNull()
    expect(worthSentence(C, e)).toBeNull()
  })
})

describe('facts', () => {
  it('ended: dates · currency · format · items', () => {
    expect(eventFacts(ev(), null)).toEqual([
      { label: 'Dates', value: 'Oct 18 – Nov 21, 2025' },
      { label: 'Currency', value: 'Candies' },
      { label: 'Format', value: 'Pass · Box' },
      { label: 'Items', value: '3' },
    ])
  })
  it('upcoming: no invented date', () => {
    expect(eventFacts(upcoming, ev())).toEqual([
      { label: 'Release Date', value: 'Not Announced' },
      { label: 'Halloween 2025 Started', value: 'Oct 18, 2025' },
      { label: 'Halloween 2025 Items', value: '3' },
      { label: 'Last Currency', value: 'Candies' },
    ])
  })
  it('format falls back to the stored one', () => {
    expect(formatLabel({ format: 'quests', items: [] })).toBe('Quests')
    expect(formatLabel({ format: null, items: [] })).toBe('Not On Record')
  })
})

describe('FAQ answers reuse the visible sentences', () => {
  it('ended event', () => {
    const e = ev()
    const faq = eventFaq(C, e, null, null)
    expect(faq.map((f) => f.q)).toEqual([
      'When did MM2 Halloween 2025 start?',
      'Can you still get Halloween 2025 items in MM2?',
      'How much are MM2 Halloween 2025 items worth?',
      'How were Halloween 2025 items obtained?',
    ])
    expect(faq[1].a).toBe(obtainableSentence(C, e))
    expect(faq[2].a).toBe(worthSentence(C, e))
    expect(faq[3].a).toBe(e.howItemsWereObtained)
  })

  it('upcoming event: release date, last start, expectations, last worth', () => {
    const last = ev()
    const p = seasonPattern([last])
    const faq = eventFaq(C, upcoming, last, p)
    expect(faq[0]).toEqual({ q: 'When is the MM2 Halloween 2026 event?', a: upcoming.summary })
    expect(faq[1]).toEqual({
      q: 'When did the last MM2 Halloween event start?',
      a: 'MM2 Halloween 2025 ran from Oct 18 to Nov 21, 2025.',
    })
    expect(faq[2].a).toBe(expectSentence(C, upcoming, p))
    expect(faq[2].a).toBe(
      'Going by the last 1 Halloween event (Halloween 2025): they started on Oct 18, ran 35 days, used Candies as the event currency and had 3 items each. MM2 has not announced anything for Halloween 2026 yet.',
    )
  })
})

describe('what to expect rows', () => {
  it('only rows the data supports', () => {
    const p = seasonPattern([ev(), ev({ name: 'Halloween 2024', startsOn: '2024-10-16', endsOn: '2024-12-09' })])
    expect(expectRows(p)).toEqual([
      { key: 'start', title: 'Start Window', value: 'Oct 16–18' },
      { key: 'length', title: 'Length', value: '35–55 days' },
      { key: 'currency', title: 'Currency', value: 'Candies' },
      { key: 'items', title: 'Items', value: '3 per event' },
    ])
    expect(expectRows(null)).toEqual([])
  })
})

describe('hub copy', () => {
  const events = [upcoming, ev(), ev({ slug: 'christmas-2015', name: 'Christmas 2015', season: 'christmas', year: 2015, startsOn: '2015-12-19', endsOn: '2016-01-08' })]

  it('answer-first lead with counts and the honest next line', () => {
    expect(hubLead(C, events, upcoming)).toBe(
      'Murder Mystery 2 has run 2 events since Christmas 2015. Every one is here with its dates, its items and what the full set is worth today. Next up: Halloween 2026 — date not announced yet.',
    )
  })

  it('featured date line never invents a date', () => {
    expect(upcomingDateLine(upcoming, ev())).toBe('Date not announced · Halloween 2025 started Oct 18, 2025')
    expect(upcomingDateLine(upcoming, null)).toBe('Date not announced')
  })

  it('FAQ: counts by season, next, first, comeback, top set', () => {
    const faq = hubFaq(C, events, upcoming)
    expect(faq[0]).toEqual({
      q: 'How many events has MM2 had?',
      a: 'Murder Mystery 2 has run 2 events since Christmas 2015: 1 Halloween, 1 Christmas.',
    })
    expect(faq[1]).toEqual({ q: 'When is the next MM2 event?', a: upcoming.summary })
    expect(faq[2].q).toBe('What was the first MM2 event?')
    expect(faq[2].a).toMatch(/^Christmas 2015 \(Dec 19, 2015 – Jan 8, 2016\) was MM2's first event\./)
    expect(faq[4]).toEqual({
      q: "Which MM2 event's items are worth the most?",
      a: 'Halloween 2025. One of every item from it costs $15.50 at today\'s cheapest prices, the most of any MM2 event.',
    })
  })
})

describe('small builders', () => {
  it('buy row reuses the item page steps', () => {
    const b = buyRow(C, ev())
    expect(b.cta).toBe('Buy Halloween 2025 Items')
    expect(b.steps.map((s) => s.title)).toEqual(['Open DropMarket', 'Pick Your Item', 'Get It In Minutes'])
    expect(b.steps[1].value).toBe('From $3.50, reputable sellers')
  })
  it('channel step value and rail title', () => {
    expect(channelStepValue([item({ name: 'A', cheapestUsd: 1 }), item({ name: 'B', cheapestUsd: 4 })])).toBe('2 Items · Top: B')
    expect(channelStepValue([item({ name: 'A' })])).toBe('1 Item')
    expect(railTitle({ season: 'halloween' })).toBe('Other Halloween Events')
  })
})
