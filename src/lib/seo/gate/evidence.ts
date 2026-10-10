import { passesValueDataGate } from '@/lib/games/indexability'
import { isMaterialValueChange } from '@/lib/seo/indexnow/value-changes'

/**
 * The evidence behind one value page, as a pure function of what was read.
 *
 * `price_moved_at` is the ONE date the page shows as "Updated", the JSON-LD
 * dateModified and the sitemap lastmod. It moves only on a MATERIAL change
 * (isMaterialValueChange: the IndexNow thresholds, 5% and $0.25), judged
 * against the ANCHOR — the value at the last move — not against yesterday, so a
 * slow drift still counts once it adds up and a re-crawl that finds the same
 * price changes nothing. Adopt Me prices each variant: any variant moving moves
 * the page.
 */
export interface SeriesPoint {
  day: string
  value: number | null
}

/** Series key → daily points in date order ('' for a single-price item, a variant code for Adopt Me). */
export type ItemSeries = Record<string, SeriesPoint[]>

export function walkAnchor(points: SeriesPoint[]): { anchor: number | null; movedOn: string | null } {
  let anchor: number | null = null
  let movedOn: string | null = null
  for (const p of points) {
    if (isMaterialValueChange(anchor, p.value)) {
      anchor = p.value
      movedOn = p.day
    }
  }
  return { anchor, movedOn }
}

export function historyDayCount(series: ItemSeries): number {
  const days = new Set<string>()
  for (const points of Object.values(series)) for (const p of points) if (p.value != null) days.add(p.day)
  return days.size
}

export interface ItemCurrent {
  /** Offers we track behind the headline price right now. */
  observations: number
  /** The headline value (null: unpriced). */
  valueUsd: number | null
  /** Current value per series key. */
  values: Record<string, number | null>
  /** The source's own change date, used only to backfill an item with no history. */
  sourceChangedAt?: string | null
}

export interface StoredEvidence {
  anchors: Record<string, number | null>
  priceMovedAt: string | null
  passesGate: boolean
  passesChangedAt: string | null
}

export interface EvidenceRow extends StoredEvidence {
  observations: number
  historyDays: number
  valueUsd: number | null
  isProtected: boolean
}

const dayStart = (day: string) => `${day}T00:00:00.000Z`
const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b)

export function nextEvidence(input: {
  current: ItemCurrent
  series: ItemSeries
  stored: StoredEvidence | null
  now: string
  isProtected: boolean
}): { row: EvidenceRow; priceMoved: boolean; gateFlipped: boolean } {
  const { current, series, stored, now } = input
  const anchors: Record<string, number | null> = {}
  let movedAt: string | null

  if (stored) {
    Object.assign(anchors, stored.anchors)
    movedAt = stored.priceMovedAt
  } else {
    // First run for this item: replay its history. A series with no history is
    // seeded from the current value and dated by the source's own change date.
    movedAt = null
    for (const [key, points] of Object.entries(series)) {
      const w = walkAnchor(points)
      if (w.movedOn == null && w.anchor == null) continue
      anchors[key] = w.anchor
      movedAt = later(movedAt, w.movedOn ? dayStart(w.movedOn) : null)
    }
    for (const [key, value] of Object.entries(current.values)) {
      if (key in anchors || value == null) continue
      anchors[key] = value
      movedAt = later(movedAt, current.sourceChangedAt ?? null)
    }
  }

  let priceMoved = false
  for (const key of new Set([...Object.keys(anchors), ...Object.keys(current.values)])) {
    const value = current.values[key] ?? null
    if (isMaterialValueChange(anchors[key] ?? null, value)) {
      anchors[key] = value
      priceMoved = true
    }
  }
  if (priceMoved) movedAt = now

  const historyDays = historyDayCount(series)
  const passesGate = passesValueDataGate({ valueUsd: current.valueUsd, observations: current.observations, historyDays })
  const gateFlipped = !!stored && stored.passesGate !== passesGate

  return {
    row: {
      observations: current.observations,
      historyDays,
      valueUsd: current.valueUsd,
      anchors,
      priceMovedAt: movedAt,
      passesGate,
      passesChangedAt: stored && !gateFlipped ? stored.passesChangedAt : now,
      isProtected: input.isProtected,
    },
    priceMoved,
    gateFlipped,
  }
}
