/**
 * Every string on the events hub and event pages, written for search first
 * (owner rule, 2026-10-05): H1 = the query people type, an answer-first lead,
 * and FAQ answers that reuse the visible sentences word for word (the FAQPage
 * schema is built from these same objects).
 *
 * Pure and unit-tested (eventsCopy.test.ts). Only true statements: every date,
 * count and dollar figure comes from the stored rows and live prices, and an
 * unknown stays "not announced" / "not on record".
 */

import {
  EVENT_SEASONS,
  eventSetValue,
  formatEventDate,
  formatEventRange,
  formatEventUsd,
  formatRange,
  formatStartWindow,
  groupByChannel,
  type EventItemView,
  type EventView,
  type SeasonPattern,
} from '@/lib/values/events-model'

export interface FaqItem {
  q: string
  a: string
}

export interface CopyCtx {
  /** "MM2" */
  shortName: string
  /** "Murder Mystery 2" */
  gameName: string
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

/** "MM2 Halloween 2025" */
export const eventLabel = (c: CopyCtx, e: Pick<EventView, 'name'>) => `${c.shortName} ${e.name}`

// ── hub ────────────────────────────────────────────────────────────────────

export function hubTitle(c: CopyCtx): string {
  return `${c.shortName} Events: Every ${c.gameName} Event and Its Items`
}

/** Events that have happened (ended or live). */
const pastOrLive = (events: EventView[]) => events.filter((e) => e.status !== 'upcoming')

function firstEvent(events: EventView[]): EventView | null {
  const past = pastOrLive(events)
  return past.length ? past[past.length - 1] : null
}

/** One line on what's next: "Next up: Halloween 2026 — date not announced yet." */
export function nextUpSentence(c: CopyCtx, featured: EventView | null): string | null {
  if (!featured) return null
  if (featured.status === 'live') {
    const ends = formatEventDate(featured.endsOn)
    return `${featured.name} is live now${ends ? ` until ${ends}` : ''}.`
  }
  const starts = formatEventDate(featured.startsOn)
  return starts
    ? `Next up: ${featured.name}, starting ${starts}.`
    : `Next up: ${featured.name} — date not announced yet.`
}

export function hubLead(c: CopyCtx, events: EventView[], featured: EventView | null): string {
  const past = pastOrLive(events)
  const first = firstEvent(events)
  const since = first ? ` since ${first.name}` : ''
  const next = nextUpSentence(c, featured)
  return `${c.gameName} has run ${plural(past.length, 'event')}${since}. Every one is here with its dates, its items and what the full set is worth today.${next ? ` ${next}` : ''}`
}

export function hubMetaDescription(c: CopyCtx, events: EventView[], featured: EventView | null): string {
  const past = pastOrLive(events)
  const first = firstEvent(events)
  const next = nextUpSentence(c, featured)
  return `All ${past.length} ${c.shortName} events${first ? ` since ${first.name}` : ''}: dates, every event item and its value in USD today, and how items were obtained.${next ? ` ${next}` : ''}`
}

/** The featured row's honest date line for an upcoming event. */
export function upcomingDateLine(featured: EventView, lastSameSeason: EventView | null): string {
  const starts = formatEventDate(featured.startsOn)
  if (starts) return `Starts ${starts}`
  const last = lastSameSeason ? formatEventDate(lastSameSeason.startsOn) : null
  return last && lastSameSeason
    ? `Date not announced · ${lastSameSeason.name} started ${last}`
    : 'Date not announced'
}

/** The most valuable event set (ended events with a priced set). */
export function topSetEvent(events: EventView[]): { event: EventView; totalUsd: number } | null {
  let best: { event: EventView; totalUsd: number } | null = null
  for (const e of events) {
    if (e.status === 'upcoming') continue
    const v = eventSetValue(e.items).totalUsd
    if (v != null && (!best || v > best.totalUsd)) best = { event: e, totalUsd: v }
  }
  return best
}

export function hubFaq(c: CopyCtx, events: EventView[], featured: EventView | null): FaqItem[] {
  const past = pastOrLive(events)
  const first = firstEvent(events)
  const out: FaqItem[] = []

  // Counts by season, biggest first: "11 Halloween, 11 Christmas, …".
  const bySeason = new Map<string, number>()
  for (const e of past) bySeason.set(EVENT_SEASONS[e.season].label, (bySeason.get(EVENT_SEASONS[e.season].label) ?? 0) + 1)
  const seasonList = [...bySeason.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => `${n} ${label}`)
    .join(', ')
  out.push({
    q: `How many events has ${c.shortName} had?`,
    a: `${c.gameName} has run ${plural(past.length, 'event')}${first ? ` since ${first.name}` : ''}: ${seasonList}.`,
  })

  if (featured) {
    out.push({
      q: `When is the next ${c.shortName} event?`,
      a: featured.summary,
    })
  }

  if (first) {
    const when = formatEventRange(first.startsOn, first.endsOn)
    out.push({
      q: `What was the first ${c.shortName} event?`,
      a: `${first.name}${when ? ` (${when})` : ''} was ${c.shortName}'s first event. ${first.summary}`,
    })
  }

  out.push({
    q: `Do ${c.shortName} event items come back?`,
    a: `No. When an ${c.shortName} event ends, its pass, boxes and shop leave with it, so event items can only be traded for or bought from other players after that.`,
  })

  const top = topSetEvent(events)
  if (top) {
    out.push({
      q: `Which ${c.shortName} event's items are worth the most?`,
      a: `${top.event.name}. One of every item from it costs ${formatEventUsd(top.totalUsd)} at today's cheapest prices, the most of any ${c.shortName} event.`,
    })
  }
  return out
}

// ── one event ──────────────────────────────────────────────────────────────

export function eventH1(c: CopyCtx, e: Pick<EventView, 'name' | 'status'>): string {
  const sep = e.name.includes(':') ? ' —' : ':'
  if (e.status === 'upcoming') return `${eventLabel(c, e)} Event${sep} Release Date and What to Expect`
  return `${eventLabel(c, e)} Event${sep} Items, Values and How to Get Them`
}

export function eventMetaTitle(c: CopyCtx, e: Pick<EventView, 'name' | 'status'>): string {
  return eventH1(c, e)
}

/** "ran from Oct 18 to Nov 21, 2025" / "started on Mar 25, 2016 (no end date on record)". */
function ranClause(e: Pick<EventView, 'startsOn' | 'endsOn' | 'status'>): string | null {
  const s = formatEventDate(e.startsOn)
  const en = formatEventDate(e.endsOn)
  if (e.status === 'live') return s ? `started on ${s}${en ? ` and runs until ${en}` : ''}` : null
  if (s && en) {
    const sameYear = e.startsOn!.slice(0, 4) === e.endsOn!.slice(0, 4)
    return `ran from ${sameYear ? s.replace(/, \d{4}$/, '') : s} to ${en}`
  }
  if (s) return `started on ${s} (no end date on record)`
  if (en) return `ended on ${en} (the exact start date is not settled)`
  return null
}

/** Items that can still be obtained in-game, per their verified how_to_get. */
export function obtainableNow(items: EventItemView[]): EventItemView[] {
  return items.filter((i) => i.howToGetStatus === 'obtainable')
}

/** The "can you still get them" answer — a plain sentence (it also sits inside the answer paragraph, so no bare "No."). */
export function obtainableSentence(c: CopyCtx, e: EventView): string {
  if (e.status === 'upcoming') return `${e.name} has not started, so its items are not out yet.`
  if (e.items.length === 0) return `${e.name} gave out no tradeable ${c.shortName} items.`
  if (e.status === 'live') return `${e.name} is live, so its items can be earned in-game until it ends.`
  const still = obtainableNow(e.items)
  if (still.length === 0) {
    return `${e.name} is over and its items do not come back, so the only way to get them now is to trade for them or buy them from another player.`
  }
  return `${e.name} is over: ${plural(still.length, 'item')} (${still
    .slice(0, 3)
    .map((i) => i.name)
    .join(', ')}${still.length > 3 ? ', …' : ''}) can still be obtained in-game, and the rest can only be traded for or bought.`
}

/** The worth sentence (null when nothing in the event has a price). */
export function worthSentence(c: CopyCtx, e: EventView): string | null {
  const v = eventSetValue(e.items)
  if (v.totalUsd == null) return null
  const top = e.items
    .filter((i) => i.cheapestUsd != null)
    .sort((a, b) => b.cheapestUsd! - a.cheapestUsd!)[0]
  const scope =
    v.pricedCount === v.itemCount
      ? `One of every ${e.name} item costs ${formatEventUsd(v.totalUsd)}`
      : `The ${v.pricedCount} ${e.name} items with a market price cost ${formatEventUsd(v.totalUsd)} together`
  return `${scope} at today's cheapest prices${top ? `; the most valuable is the ${top.name} at ${formatEventUsd(top.cheapestUsd!)}` : ''}.`
}

/**
 * The answer paragraph, split so the page can bold the first clause:
 * `lead` answers "when", `body` covers how, how many, worth and obtainability.
 */
export function eventAnswer(c: CopyCtx, e: EventView, lastSameSeason: EventView | null): { lead: string; body: string } {
  if (e.status === 'upcoming') {
    const last = lastSameSeason
    const v = last ? eventSetValue(last.items) : null
    let lastLine = ''
    if (last && v && v.itemCount > 0) {
      const worth =
        v.totalUsd == null
          ? ''
          : v.pricedCount === v.itemCount
            ? `, worth ${formatEventUsd(v.totalUsd)} together at today's prices`
            : `; the ${v.pricedCount} with a market price are worth ${formatEventUsd(v.totalUsd)} together today`
      lastLine = `${last.name} had ${plural(v.itemCount, 'item')}${worth}.`
    }
    return { lead: e.summary, body: lastLine }
  }

  const ran = ranClause(e)
  const lead = `${eventLabel(c, e)} ${ran ?? 'happened in ' + e.year}.`
  const parts: string[] = [e.summary]
  if (e.items.length > 0) parts.push(itemsWorthShort(e))
  parts.push(obtainableShort(c, e))
  return { lead, body: parts.join(' ') }
}

/** "Its 31 items cost $1,039 at today's cheapest prices (22 have a price), led by the Raygun at $12.00." */
function itemsWorthShort(e: EventView): string {
  const v = eventSetValue(e.items)
  const items = plural(v.itemCount, 'tradeable item')
  if (v.totalUsd == null) return `It had ${items}; none has a market price yet.`
  const top = e.items
    .filter((i) => i.cheapestUsd != null)
    .sort((a, b) => b.cheapestUsd! - a.cheapestUsd!)[0]
  const priced = v.pricedCount === v.itemCount ? '' : ` (${v.pricedCount} have a price)`
  return `Its ${items} cost ${formatEventUsd(v.totalUsd)} together at today's cheapest prices${priced}, led by the ${top.name} at ${formatEventUsd(top.cheapestUsd!)}.`
}

/** The answer's short obtainability clause; the FAQ and callout carry the full sentence. */
function obtainableShort(c: CopyCtx, e: EventView): string {
  if (e.status !== 'ended' || e.items.length === 0) return obtainableSentence(c, e)
  const still = obtainableNow(e.items).length
  return still === 0
    ? 'Event items never come back, so they are trade-only now.'
    : `${plural(still, 'item')} can still be obtained in-game; the rest are trade-only now.`
}

export function eventMetaDescription(c: CopyCtx, e: EventView, lastSameSeason: EventView | null): string {
  const a = eventAnswer(c, e, lastSameSeason)
  const text = `${a.lead} ${a.body}`.trim()
  return text.length > 300 ? `${text.slice(0, 297).replace(/\s+\S*$/, '')}…` : text
}

/** The blue callout under the facts. */
export function setValueCallout(e: EventView): { title: string; body: string } | null {
  const v = eventSetValue(e.items)
  if (v.totalUsd == null) return null
  return {
    title: `Set Value: ${formatEventUsd(v.totalUsd)}`,
    body:
      v.pricedCount === v.itemCount
        ? 'every item from this event at today’s cheapest prices'
        : `the ${v.pricedCount} of ${v.itemCount} items with a market price, at today’s cheapest prices`,
  }
}

/** Facts line values: Dates · Currency · Format · Items. */
export function eventFacts(e: EventView, lastSameSeason: EventView | null): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  if (e.status === 'upcoming') {
    out.push({ label: 'Release Date', value: formatEventDate(e.startsOn) ?? 'Not Announced' })
    if (lastSameSeason) {
      const last = formatEventDate(lastSameSeason.startsOn)
      if (last) out.push({ label: `${lastSameSeason.name} Started`, value: last })
      out.push({ label: `${lastSameSeason.name} Items`, value: String(eventSetValue(lastSameSeason.items).itemCount) })
      if (lastSameSeason.currency) out.push({ label: 'Last Currency', value: lastSameSeason.currency })
    }
    return out
  }
  out.push({ label: 'Dates', value: formatEventRange(e.startsOn, e.endsOn) ?? 'Not On Record' })
  if (e.currency) out.push({ label: 'Currency', value: e.currency })
  out.push({ label: 'Format', value: formatLabel(e) })
  out.push({ label: 'Items', value: String(eventSetValue(e.items).itemCount) })
  return out
}

/** "Pass · Box · Bundles" from the channels, else the stored format. */
export function formatLabel(e: Pick<EventView, 'format' | 'items'>): string {
  const groups = groupByChannel(e.items).filter((g) => g.channel !== 'other')
  if (groups.length > 0) {
    const SHORT: Record<string, string> = {
      pass: 'Pass',
      box: 'Box',
      robux: 'Bundles',
      shop: 'Shop',
      craft: 'Crafting',
      leaderboard: 'Leaderboard',
      tasks: 'Tasks',
    }
    return groups
      .slice(0, 3)
      .map((g) => SHORT[g.channel])
      .join(' · ')
  }
  const F: Record<string, string> = {
    'event shop': 'Event Shop',
    'event box': 'Event Box',
    quests: 'Quests',
    mixed: 'Mixed',
    other: 'Roblox Event',
  }
  return (e.format && F[e.format]) || 'Not On Record'
}

export function eventFaq(c: CopyCtx, e: EventView, lastSameSeason: EventView | null, pattern: SeasonPattern | null): FaqItem[] {
  const L = eventLabel(c, e)
  const out: FaqItem[] = []
  if (e.status === 'upcoming') {
    out.push({ q: `When is the ${L} event?`, a: e.summary })
    if (lastSameSeason) {
      const ran = ranClause(lastSameSeason)
      if (ran) out.push({ q: `When did the last ${c.shortName} ${EVENT_SEASONS[e.season].label} event start?`, a: `${eventLabel(c, lastSameSeason)} ${ran}.` })
    }
    const expect = expectSentence(c, e, pattern)
    if (expect) out.push({ q: `What can you expect from ${L}?`, a: expect })
    if (lastSameSeason) {
      const worth = worthSentence(c, lastSameSeason)
      if (worth) out.push({ q: `How much are ${lastSameSeason.name} items worth?`, a: worth })
    }
    return out
  }
  const ran = ranClause(e)
  if (ran) out.push({ q: `When did ${L} start?`, a: `${L} ${ran}.` })
  out.push({ q: `Can you still get ${e.name} items in ${c.shortName}?`, a: obtainableSentence(c, e) })
  const worth = worthSentence(c, e)
  if (worth) out.push({ q: `How much are ${L} items worth?`, a: worth })
  if (e.howItemsWereObtained) out.push({ q: `How were ${e.name} items obtained?`, a: e.howItemsWereObtained })
  return out
}

// ── what to expect (upcoming) ──────────────────────────────────────────────

/** "Going by the last 3 Halloween events: …" — only ranges from the data. */
export function expectSentence(c: CopyCtx, e: EventView, p: SeasonPattern | null): string | null {
  if (!p || p.basis.length === 0) return null
  const bits: string[] = []
  if (p.startRange) {
    bits.push(
      p.startRange.from === p.startRange.to
        ? `they started on ${p.startRange.from}`
        : `they started between ${p.startRange.from} and ${p.startRange.to}`,
    )
  }
  if (p.lengthDays) bits.push(`ran ${formatRange(p.lengthDays).replace('–', ' to ')} days`)
  if (p.currencies.length === 1) bits.push(`used ${p.currencies[0]} as the event currency`)
  if (p.itemCount) bits.push(`had ${formatRange(p.itemCount).replace('–', ' to ')} items each`)
  if (bits.length === 0) return null
  const list = bits.length > 1 ? `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}` : bits[0]
  return `Going by the last ${plural(p.basis.length, `${EVENT_SEASONS[e.season].label} event`)} (${p.basis.join(', ')}): ${list}. ${c.shortName} has not announced anything for ${e.name} yet.`
}

/** The "What To Expect" step tiles: title + one value line each. */
export function expectRows(p: SeasonPattern | null): { key: 'start' | 'length' | 'currency' | 'items'; title: string; value: string }[] {
  if (!p) return []
  const out: { key: 'start' | 'length' | 'currency' | 'items'; title: string; value: string }[] = []
  if (p.startRange) out.push({ key: 'start', title: 'Start Window', value: formatStartWindow(p.startRange) })
  if (p.lengthDays) out.push({ key: 'length', title: 'Length', value: `${formatRange(p.lengthDays)} days` })
  if (p.currencies.length) out.push({ key: 'currency', title: 'Currency', value: p.currencies.join(' / ') })
  if (p.itemCount) out.push({ key: 'items', title: 'Items', value: `${formatRange(p.itemCount)} per event` })
  return out
}

// ── buy row ────────────────────────────────────────────────────────────────

/**
 * Row 2 of the how-to section: the same three owner-approved steps as the
 * item page's "Buy It for Cheap" (Open DropMarket → Buy → delivered by
 * in-game trade), for the event's items.
 */
export function buyRow(c: CopyCtx, e: Pick<EventView, 'name' | 'items'>): {
  heading: string
  cta: string
  steps: { icon: 'store' | 'cart' | 'bolt'; title: string; value: string }[]
} {
  const prices = e.items.map((i) => i.cheapestUsd).filter((p): p is number => p != null && p > 0)
  const from = prices.length ? formatEventUsd(Math.min(...prices)) : null
  return {
    heading: `Buy ${e.name} Items`,
    cta: `Buy ${e.name} Items`,
    steps: [
      { icon: 'store', title: 'Open DropMarket', value: `${c.shortName} listings for ${e.name} items` },
      { icon: 'cart', title: 'Pick Your Item', value: from ? `From ${from}, reputable sellers` : 'From reputable sellers' },
      { icon: 'bolt', title: 'Get It In Minutes', value: `Delivered by in-game trade in ${c.gameName}` },
    ],
  }
}

/** "10 Items · Raygun" — a channel step's value line. */
export function channelStepValue(items: Pick<EventItemView, 'name' | 'cheapestUsd'>[]): string {
  const top = [...items].filter((i) => i.cheapestUsd != null).sort((a, b) => b.cheapestUsd! - a.cheapestUsd!)[0]
  return `${plural(items.length, 'Item')}${top ? ` · Top: ${top.name}` : ''}`
}

/** "Other Halloween Events" / "Other Collab Events" / "Other Special Events". */
export function railTitle(e: Pick<EventView, 'season'>): string {
  return `Other ${EVENT_SEASONS[e.season].label} Events`
}
