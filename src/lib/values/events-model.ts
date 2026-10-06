/**
 * The events archive model (values_events, migration 20261005232558): the
 * row shape, the resolved view the pages render, and the plain maths behind
 * every number on them — set value, date lines, season groups, the obtain
 * channels and the "what to expect" ranges. Pure and client-safe: the server
 * reader (./events.ts) builds these views, the client timeline filters them,
 * and the unit tests pin the maths.
 *
 * Truth rule: every number here is computed from the stored rows (dates,
 * items, live prices). Nothing is estimated, and a missing date stays missing.
 */

import type { HowToGetStatus } from './how-to-get'

export type EventSeason =
  | 'halloween'
  | 'christmas'
  | 'easter'
  | 'valentines'
  | 'summer'
  | 'anniversary'
  | 'collab'
  | 'other'

export type EventStatus = 'ended' | 'live' | 'upcoming'

/** One item as the researched seed lists it (values_events.items). */
export interface EventItemRow {
  name: string
  slug: string | null
  kind: string | null
  rarity: string | null
  how: string | null
}

/** An event item joined to the catalogue and its live price. */
export interface EventItemView {
  /** Catalogue name when matched, else the seed's name. */
  name: string
  slug: string | null
  rarity: string | null
  itemType: string | null
  imageUrl: string | null
  how: string | null
  cheapestUsd: number | null
  marketUsd: number | null
  /** Its value page, or null (no page for commons / unpriced / unmatched). */
  href: string | null
  /** The item's verified how_to_get status, when it has one. */
  howToGetStatus: HowToGetStatus | null
}

export interface EventView {
  slug: string
  name: string
  season: EventSeason
  year: number
  status: EventStatus
  /** YYYY-MM-DD or null when not on record. */
  startsOn: string | null
  endsOn: string | null
  currency: string | null
  format: string | null
  summary: string
  howItemsWereObtained: string | null
  items: EventItemView[]
  sources: string[]
  checkedAt: string
  updatedAt: string | null
}

// ── seasons ────────────────────────────────────────────────────────────────

export interface SeasonMeta {
  label: string
  /** Tint for the icon tile and the row glow. */
  color: string
}

export const EVENT_SEASONS: Record<EventSeason, SeasonMeta> = {
  halloween: { label: 'Halloween', color: '#F28C38' },
  christmas: { label: 'Christmas', color: '#78C6FF' },
  easter: { label: 'Easter', color: '#9BD86A' },
  valentines: { label: "Valentine's", color: '#FF6B9A' },
  summer: { label: 'Summer', color: '#FFC94D' },
  anniversary: { label: 'Anniversary', color: '#F5C542' },
  collab: { label: 'Collab', color: '#5EE2C6' },
  other: { label: 'Special', color: '#D9A066' },
}

/** The hub's filter chips: four big seasons, everything else under Other. */
export const SEASON_FILTERS = [
  { key: 'halloween', label: 'Halloween' },
  { key: 'christmas', label: 'Christmas' },
  { key: 'easter', label: 'Easter' },
  { key: 'summer', label: 'Summer' },
  { key: 'other', label: 'Other' },
] as const

export type SeasonFilterKey = (typeof SEASON_FILTERS)[number]['key']

export function seasonFilterOf(season: EventSeason): SeasonFilterKey {
  return season === 'halloween' || season === 'christmas' || season === 'easter' || season === 'summer'
    ? season
    : 'other'
}

const SEASONS = new Set<EventSeason>(Object.keys(EVENT_SEASONS) as EventSeason[])
export const isEventSeason = (v: unknown): v is EventSeason => typeof v === 'string' && SEASONS.has(v as EventSeason)

/** "#F28C38" → "242,140,56" for rgba() washes. */
export function hexRgb(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '255,255,255'
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

// ── dates ──────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parts(d: string): { y: number; m: number; day: number } | null {
  const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (!mm) return null
  return { y: Number(mm[1]), m: Number(mm[2]) - 1, day: Number(mm[3]) }
}

/** "2025-10-18" → "Oct 18, 2025". */
export function formatEventDate(d: string | null): string | null {
  const p = d ? parts(d) : null
  return p ? `${MONTHS[p.m]} ${p.day}, ${p.y}` : null
}

/** "2025-10-18" → "Oct 18" (no year). */
function monthDay(d: string): string | null {
  const p = parts(d)
  return p ? `${MONTHS[p.m]} ${p.day}` : null
}

/**
 * The compact date line: "Oct 18 – Nov 21, 2025", "Dec 14, 2025 – Jan 19, 2026",
 * "From Mar 25, 2016" (no end on record), "Until May 3, 2023" (no start on
 * record), or null when neither is known.
 */
export function formatEventRange(startsOn: string | null, endsOn: string | null): string | null {
  const s = startsOn ? parts(startsOn) : null
  const e = endsOn ? parts(endsOn) : null
  if (s && e) {
    return s.y === e.y
      ? `${monthDay(startsOn!)} – ${formatEventDate(endsOn)}`
      : `${formatEventDate(startsOn)} – ${formatEventDate(endsOn)}`
  }
  if (s) return `From ${formatEventDate(startsOn)}`
  if (e) return `Until ${formatEventDate(endsOn)}`
  return null
}

/** Whole days from start to end, inclusive; null unless both are known. */
export function eventLengthDays(startsOn: string | null, endsOn: string | null): number | null {
  if (!startsOn || !endsOn) return null
  const a = Date.parse(`${startsOn}T00:00:00Z`)
  const b = Date.parse(`${endsOn}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  return Math.round((b - a) / 86_400_000) + 1
}

// ── money ──────────────────────────────────────────────────────────────────

/** Cents under $1,000, whole dollars above. */
export const formatEventUsd = (v: number) =>
  v >= 1000
    ? v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface SetValue {
  /** Sum of the cheapest prices of the event's priced items; null when none is priced. */
  totalUsd: number | null
  /** Distinct items with a price. */
  pricedCount: number
  /** Distinct items in the event. */
  itemCount: number
}

/**
 * The set value: what one of every item from the event costs at today's
 * cheapest prices. An item listed twice is counted once (by slug, else name).
 */
export function eventSetValue(items: Pick<EventItemView, 'slug' | 'name' | 'cheapestUsd'>[]): SetValue {
  const seen = new Set<string>()
  let total = 0
  let priced = 0
  for (const i of items) {
    const key = i.slug ?? `name:${i.name.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    if (i.cheapestUsd != null && Number.isFinite(i.cheapestUsd) && i.cheapestUsd > 0) {
      total += i.cheapestUsd
      priced += 1
    }
  }
  // Rounded to cents: a sum of cent prices must not print float noise.
  return { totalUsd: priced > 0 ? Math.round(total * 100) / 100 : null, pricedCount: priced, itemCount: seen.size }
}

/** Items in display order: priced first by price, then by rarity rank, then name. */
export function sortEventItems<T extends Pick<EventItemView, 'name' | 'cheapestUsd' | 'rarity'>>(
  items: T[],
  rarityRank: (r: string | null) => number,
): T[] {
  return [...items].sort((a, b) => {
    const ap = a.cheapestUsd != null
    const bp = b.cheapestUsd != null
    if (ap !== bp) return ap ? -1 : 1
    if (ap && bp && b.cheapestUsd! !== a.cheapestUsd!) return b.cheapestUsd! - a.cheapestUsd!
    const r = rarityRank(a.rarity) - rarityRank(b.rarity)
    return r !== 0 ? r : a.name.localeCompare(b.name)
  })
}

// ── ordering + grouping ────────────────────────────────────────────────────

/** Newest first: by year, then start date (an undated upcoming event leads its year). */
export function sortEventsNewestFirst<T extends Pick<EventView, 'year' | 'startsOn' | 'endsOn'>>(events: T[]): T[] {
  const key = (e: T) => e.startsOn ?? e.endsOn ?? '9999-12-31'
  return [...events].sort((a, b) => b.year - a.year || key(b).localeCompare(key(a)))
}

export function groupEventsByYear<T extends Pick<EventView, 'year'>>(events: T[]): { year: number; events: T[] }[] {
  const out: { year: number; events: T[] }[] = []
  for (const e of events) {
    const last = out[out.length - 1]
    if (last && last.year === e.year) last.events.push(e)
    else out.push({ year: e.year, events: [e] })
  }
  return out
}

/** The live event, else the soonest upcoming one, else null. */
export function featuredEvent<T extends Pick<EventView, 'status' | 'startsOn' | 'year'>>(events: T[]): T | null {
  const live = events.find((e) => e.status === 'live')
  if (live) return live
  const upcoming = events
    .filter((e) => e.status === 'upcoming')
    .sort((a, b) => (a.startsOn ?? `${a.year}-12-31`).localeCompare(b.startsOn ?? `${b.year}-12-31`))
  return upcoming[0] ?? null
}

/** Same-season events before `event`, newest first (the "last year" / "what to expect" set). */
export function previousSameSeason<T extends Pick<EventView, 'slug' | 'season' | 'year' | 'startsOn' | 'endsOn' | 'status'>>(
  events: T[],
  event: Pick<EventView, 'slug' | 'season' | 'year'>,
): T[] {
  return sortEventsNewestFirst(
    events.filter((e) => e.slug !== event.slug && e.season === event.season && e.year < event.year && e.status === 'ended'),
  )
}

/** Index rule shared by the page's robots meta and the sitemap: an ended event with no items is thin. */
export function isEventIndexable(e: { status: string; itemCount: number }): boolean {
  return e.status !== 'ended' || e.itemCount > 0
}

// ── how items were obtained ────────────────────────────────────────────────

export type ObtainChannel = 'pass' | 'box' | 'robux' | 'shop' | 'craft' | 'leaderboard' | 'tasks' | 'other'

export const CHANNEL_LABEL: Record<ObtainChannel, string> = {
  pass: 'Event Pass',
  box: 'Event Box',
  robux: 'Robux Bundles',
  shop: 'Event Shop',
  craft: 'Crafting',
  leaderboard: 'Leaderboard',
  tasks: 'Tasks & Rewards',
  other: 'Other',
}

/** Which way an item came out of the event, from the seed's `how` line. */
export function obtainChannel(how: string | null): ObtainChannel {
  const h = (how ?? '').toLowerCase()
  if (!h) return 'other'
  if (/robux|gamepass|bundle/.test(h)) return 'robux'
  if (/leaderboard/.test(h)) return 'leaderboard'
  if (/craft|recipe/.test(h)) return 'craft'
  if (/battle pass|event pass|\bpass reward|\btier\b/.test(h)) return 'pass'
  if (/unbox|\bbox\b|crate/.test(h)) return 'box'
  if (/\bshop\b|bought/.test(h)) return 'shop'
  if (/challenge|task|quest|bingo|reward/.test(h)) return 'tasks'
  return 'other'
}

export interface ChannelGroup<T> {
  channel: ObtainChannel
  label: string
  items: T[]
}

/** Items grouped by channel, biggest group first ("other" always last). */
export function groupByChannel<T extends Pick<EventItemView, 'how'>>(items: T[]): ChannelGroup<T>[] {
  const map = new Map<ObtainChannel, T[]>()
  for (const i of items) {
    const c = obtainChannel(i.how)
    map.set(c, [...(map.get(c) ?? []), i])
  }
  return [...map.entries()]
    .map(([channel, list]) => ({ channel, label: CHANNEL_LABEL[channel], items: list }))
    .sort((a, b) => {
      if (a.channel === 'other' || b.channel === 'other') return a.channel === 'other' ? 1 : -1
      return b.items.length - a.items.length
    })
}

// ── what to expect (upcoming) ──────────────────────────────────────────────

export interface SeasonPattern {
  /** The events the ranges come from, newest first. */
  basis: string[]
  /** Earliest and latest start, as "Oct 16" / "Oct 18" (month-day only). */
  startRange: { from: string; to: string } | null
  lengthDays: { min: number; max: number } | null
  /** Every distinct currency, in order of first appearance. */
  currencies: string[]
  itemCount: { min: number; max: number } | null
}

/**
 * The plain ranges behind "What To Expect": start window, length, currency
 * and item count across the given past events. Only fields every basis event
 * has go into a range; a missing date just narrows the basis for that field.
 */
export function seasonPattern(
  past: Pick<EventView, 'name' | 'startsOn' | 'endsOn' | 'currency' | 'items'>[],
): SeasonPattern {
  const starts = past.map((e) => e.startsOn).filter((d): d is string => !!d)
  // Compare by month-day so different years line up.
  const md = starts.map((d) => d.slice(5)).sort()
  const toLabel = (m: string) => monthDay(`2000-${m}`)!
  const lengths = past.map((e) => eventLengthDays(e.startsOn, e.endsOn)).filter((n): n is number => n != null)
  const counts = past.map((e) => eventSetValue(e.items).itemCount).filter((n) => n > 0)
  const currencies: string[] = []
  for (const e of past) if (e.currency && !currencies.includes(e.currency)) currencies.push(e.currency)
  return {
    basis: past.map((e) => e.name),
    startRange: md.length ? { from: toLabel(md[0]), to: toLabel(md[md.length - 1]) } : null,
    lengthDays: lengths.length ? { min: Math.min(...lengths), max: Math.max(...lengths) } : null,
    currencies,
    itemCount: counts.length ? { min: Math.min(...counts), max: Math.max(...counts) } : null,
  }
}

/** "Oct 16–18" / "Oct 18" / "Sep 30 – Oct 2". */
export function formatStartWindow(r: { from: string; to: string }): string {
  if (r.from === r.to) return r.from
  const [fm, fd] = r.from.split(' ')
  const [tm, td] = r.to.split(' ')
  return fm === tm ? `${fm} ${fd}–${td}` : `${r.from} – ${r.to}`
}

/** "34" / "34–55". */
export const formatRange = (r: { min: number; max: number }) => (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`)
