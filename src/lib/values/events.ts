import 'server-only'
import { createValuesReadClient } from '@/lib/values/read-client'
import { getValueItems, type ValueItem } from '@/lib/values/data'
import { parseHowToGet } from '@/lib/values/how-to-get'
import { valueItemHasPage } from '@/lib/values/hub-config'
import {
  isEventSeason,
  sortEventsNewestFirst,
  type EventItemRow,
  type EventItemView,
  type EventStatus,
  type EventView,
} from '@/lib/values/events-model'

/**
 * Read layer for the events archive (values_events, anon SELECT of published
 * rows). Every read goes through the tagged values client, so the pages carry
 * `values:<game>` (+ `price:<game>` for the live prices) and
 * /api/internal/values-revalidate refreshes them with the rest of the hub —
 * an event added or corrected by `pnpm values:mm2:events` shows after a
 * `?full=1` revalidate, no deploy.
 *
 * Item slugs resolve to values_items at read time, so names, art and prices
 * are always the catalogue's current ones.
 */

type EventRow = {
  slug: string
  name: string
  season: string
  year: number
  status: string
  starts_on: string | null
  ends_on: string | null
  currency: string | null
  format: string | null
  summary: string
  how_items_were_obtained: string | null
  items: unknown
  sources: unknown
  checked_at: string
  updated_at: string | null
}

const EVENT_COLS =
  'slug,name,season,year,status,starts_on,ends_on,currency,format,summary,how_items_were_obtained,items,sources,checked_at,updated_at'

const STATUSES = new Set<EventStatus>(['ended', 'live', 'upcoming'])

type ReadClient = ReturnType<typeof createValuesReadClient>

async function gameIdFor(supabase: ReadClient, slug: string): Promise<string | null> {
  const { data } = await (supabase as any).from('games').select('id').eq('slug', slug).maybeSingle()
  return data?.id ?? null
}

function itemRows(raw: unknown): EventItemRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && typeof (r as any).name === 'string')
    .map((r) => ({
      name: String(r.name),
      slug: typeof r.slug === 'string' && r.slug ? r.slug : null,
      kind: typeof r.kind === 'string' ? r.kind : null,
      rarity: typeof r.rarity === 'string' ? r.rarity : null,
      how: typeof r.how === 'string' && r.how.trim() ? r.how.trim() : null,
    }))
}

async function readEventRows(gameSlug: string): Promise<EventRow[]> {
  const supabase = createValuesReadClient({ gameSlug })
  const gameId = await gameIdFor(supabase, gameSlug)
  if (!gameId) return []
  const { data, error } = await (supabase as any)
    .from('values_events')
    .select(EVENT_COLS)
    .eq('game_id', gameId)
    .eq('is_published', true)
    .order('year', { ascending: false })
    .limit(500)
  if (error) {
    console.error('values_events read:', error)
    return []
  }
  return (data ?? []) as EventRow[]
}

/** how_to_get status per item slug (only items that have verified facts). */
async function howToGetStatuses(gameSlug: string, slugs: string[]): Promise<Map<string, EventItemView['howToGetStatus']>> {
  const out = new Map<string, EventItemView['howToGetStatus']>()
  if (slugs.length === 0) return out
  const supabase = createValuesReadClient({ gameSlug })
  const gameId = await gameIdFor(supabase, gameSlug)
  if (!gameId) return out
  const { data, error } = await (supabase as any)
    .from('values_items')
    .select('slug,how_to_get')
    .eq('game_id', gameId)
    .eq('is_enabled', true)
    .not('how_to_get', 'is', null)
    .in('slug', [...new Set(slugs)].sort())
  if (error) {
    console.error('values_events how_to_get read:', error)
    return out
  }
  for (const r of (data ?? []) as { slug: string; how_to_get: unknown }[]) {
    const h = parseHowToGet(r.how_to_get)
    if (h) out.set(r.slug, h.status)
  }
  return out
}

function toView(
  gameSlug: string,
  row: EventRow,
  bySlug: Map<string, ValueItem>,
  statuses: Map<string, EventItemView['howToGetStatus']>,
): EventView | null {
  if (!isEventSeason(row.season) || !STATUSES.has(row.status as EventStatus)) return null
  const items: EventItemView[] = itemRows(row.items).map((r) => {
    const it = r.slug ? bySlug.get(r.slug) ?? null : null
    const cheapestUsd = it?.price?.cheapestUsd ?? null
    const rarity = it?.rarity ?? r.rarity
    return {
      name: it?.name ?? r.name,
      slug: it ? it.slug : null,
      rarity,
      itemType: it?.itemType ?? r.kind,
      imageUrl: it?.imageUrl ?? null,
      how: r.how,
      cheapestUsd,
      marketUsd: it?.price?.averageUsd ?? null,
      href:
        it && valueItemHasPage(gameSlug, { rarity, priced: cheapestUsd != null })
          ? `/${gameSlug}/values/${it.slug}`
          : null,
      howToGetStatus: it ? statuses.get(it.slug) ?? null : null,
    }
  })
  return {
    slug: row.slug,
    name: row.name,
    season: row.season,
    year: row.year,
    status: row.status as EventStatus,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    currency: row.currency,
    format: row.format,
    summary: row.summary,
    howItemsWereObtained: row.how_items_were_obtained,
    items,
    sources: Array.isArray(row.sources) ? row.sources.filter((s): s is string => typeof s === 'string') : [],
    checkedAt: row.checked_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Every published event of a game, newest first, with items resolved to the
 * catalogue and live prices. `withHowToGet` adds each item's verified
 * how_to_get status (the event page's "can you still get them" answer).
 */
export async function getValueEvents(
  gameSlug: string,
  opts: { withHowToGet?: boolean } = {},
): Promise<EventView[]> {
  const [rows, catalogue] = await Promise.all([readEventRows(gameSlug), getValueItems(gameSlug)])
  if (rows.length === 0) return []
  const bySlug = new Map(catalogue.map((i) => [i.slug, i]))
  const statuses = opts.withHowToGet
    ? await howToGetStatuses(
        gameSlug,
        rows.flatMap((r) => itemRows(r.items).map((i) => i.slug).filter((s): s is string => !!s && bySlug.has(s))),
      )
    : new Map()
  const views = rows.map((r) => toView(gameSlug, r, bySlug, statuses)).filter((v): v is EventView => v != null)
  return sortEventsNewestFirst(views)
}

/** One event (plus every event, for the same-season rail and "last year"). */
export async function getValueEvent(
  gameSlug: string,
  slug: string,
): Promise<{ event: EventView; all: EventView[] } | null> {
  const all = await getValueEvents(gameSlug, { withHowToGet: true })
  const event = all.find((e) => e.slug === slug)
  return event ? { event, all } : null
}

/** Event slugs for a game — the event route's prerender set. */
export async function getValueEventSlugs(gameSlug: string): Promise<string[]> {
  return (await readEventRows(gameSlug)).map((r) => r.slug)
}

/**
 * The event route's gate + header: one event's name/season/status, or null
 * (→ 404) — before the page streams anything. Same tagged query as the full
 * read, so the body's read is served from the same cache entry.
 */
export async function getValueEventHead(
  gameSlug: string,
  slug: string,
): Promise<Pick<EventView, 'slug' | 'name' | 'season' | 'status' | 'year'> | null> {
  const row = (await readEventRows(gameSlug)).find((r) => r.slug === slug)
  if (!row || !isEventSeason(row.season) || !STATUSES.has(row.status as EventStatus)) return null
  return { slug: row.slug, name: row.name, season: row.season, status: row.status as EventStatus, year: row.year }
}

/**
 * The event an item first came from, for the "From the <Event> Event" link
 * on its value page. Read under the ITEM's tags (item pages never bind the
 * game list tag). The earliest event wins: an item's origin, not a rerun.
 */
export async function getValueItemEvent(
  gameSlug: string,
  itemSlug: string,
): Promise<{ slug: string; name: string } | null> {
  const supabase = createValuesReadClient({ gameSlug, itemSlug })
  const gameId = await gameIdFor(supabase, gameSlug)
  if (!gameId) return null
  const { data, error } = await (supabase as any)
    .from('values_events')
    .select('slug,name,year,starts_on')
    .eq('game_id', gameId)
    .eq('is_published', true)
    // jsonb containment: the items array has an entry with this slug.
    .contains('items', JSON.stringify([{ slug: itemSlug }]))
    .order('year', { ascending: true })
    .order('starts_on', { ascending: true, nullsFirst: false })
    .limit(1)
  if (error) {
    console.error('getValueItemEvent:', error)
    return null
  }
  const row = (data ?? [])[0] as { slug: string; name: string } | undefined
  return row ? { slug: row.slug, name: row.name } : null
}

/**
 * Item slug → the event it first came from (earliest year, then start date),
 * for every item any published event lists. One tagged read of the events
 * (no catalogue join) — the Chroma hub labels and groups its rows with it.
 */
export async function getValueItemEventMap(gameSlug: string): Promise<Map<string, { slug: string; name: string }>> {
  const rows = await readEventRows(gameSlug)
  const oldestFirst = [...rows].sort(
    (a, b) => a.year - b.year || (a.starts_on ?? '9999').localeCompare(b.starts_on ?? '9999'),
  )
  const out = new Map<string, { slug: string; name: string }>()
  for (const r of oldestFirst) {
    for (const i of itemRows(r.items)) if (i.slug && !out.has(i.slug)) out.set(i.slug, { slug: r.slug, name: r.name })
  }
  return out
}

/**
 * Event slug → name for every published event (one tagged read, no catalogue
 * join). The Box Odds pages link a retired box to its event only when the
 * event is published, with the event's own name.
 */
export async function getValueEventNames(gameSlug: string): Promise<Map<string, string>> {
  return new Map((await readEventRows(gameSlug)).map((r) => [r.slug, r.name]))
}
