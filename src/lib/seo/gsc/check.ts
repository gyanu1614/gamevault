import { RESERVED_GAME_SLUGS } from '@/lib/games/validate-game'
import { GAME_HUB_SEGMENTS } from '../../../../scripts/lib/gsc/page-type'

/**
 * The daily Google check, pure parts: which URLs to inspect today, which
 * section a URL belongs to, the per-section index rate, and what to alert on.
 * The orchestration (reads, Search Console calls, writes, Discord) is ./daily.ts.
 */

/** Inspections per day. Google allows 2,000 per property; the rest is headroom for `pnpm gsc:index-report`. */
export const DAILY_INSPECTION_CAP = 1500
/** A section needs this many inspected URLs on both days before its rate is compared. */
export const MIN_SECTION_SAMPLE = 20
/** Relative week-on-week drop that raises an alert. */
export const SECTION_DROP_RATIO = 0.1
/** An alert of the same kind for the same URL/section is not repeated within this window. */
export const ALERT_DEDUPE_DAYS = 7

/** Static folders under /[gameSlug] (anything else at depth 2 is a category page). */
const HUB_SECOND_SEGMENTS: ReadonlySet<string> = new Set(GAME_HUB_SEGMENTS)

/** The sitemap section a path belongs to (for URLs Google reports that the sitemap does not list). */
export function sectionOfPath(path: string): string {
  const segs = path.split(/[?#]/)[0].split('/').filter(Boolean)
  if (segs.length === 0) return 'static'
  const [first, second, third] = segs
  if (first === 'blog' || second === 'blog') return 'blog'
  if (first === 'buy') return 'buy'
  // A reserved first segment is one of the site's own routes; anything else is a game.
  if (RESERVED_GAME_SLUGS.has(first)) return 'static'
  if (segs.length === 1) return 'hubs'
  if (second === 'values' && third && third !== 'methodology') return `values-${first}`
  if (second === 'sell') return 'sell'
  if (segs.length === 2 && !HUB_SECOND_SEGMENTS.has(second)) return 'buy'
  return 'hubs'
}

export function pickInspectionTargets(input: {
  /** URLs logged as changed in the last 72 h. */
  changed: string[]
  sitemap: string[]
  /** url → last inspected_at. */
  lastInspected: ReadonlyMap<string, string>
  todayStart: string
  remaining: number
}): string[] {
  if (input.remaining <= 0) return []
  const doneToday = (u: string) => (input.lastInspected.get(u) ?? '') >= input.todayStart
  const out: string[] = []
  const seen = new Set<string>()
  const take = (u: string) => {
    if (out.length >= input.remaining || seen.has(u) || doneToday(u)) return
    seen.add(u)
    out.push(u)
  }
  for (const u of input.changed) take(u)
  // Rotating sample: never inspected first, then the oldest inspection.
  const rotation = [...input.sitemap].sort((a, b) => (input.lastInspected.get(a) ?? '').localeCompare(input.lastInspected.get(b) ?? ''))
  for (const u of rotation) take(u)
  return out
}

export interface InspectionRow {
  url: string
  section: string
  verdict: string | null
  previousVerdict: string | null
  coverageState: string | null
  robotsState: string | null
  pageFetchState: string | null
  googleCanonical: string | null
  userCanonical: string | null
  inSitemap: boolean
}

export interface SectionCount {
  section: string
  inspected: number
  indexed: number
}

export type AlertKind = 'indexed-page-dropped' | 'section-index-rate-drop' | 'robots-blocked' | 'fetch-error' | 'canonical-mismatch'

export interface NewAlert {
  kind: AlertKind
  url: string | null
  section: string | null
  message: string
  details: Record<string, unknown>
}

/** Pages that earn or lead to money: value pages, buy/category pages, game and value hubs. */
const isMoneySection = (s: string) => s.startsWith('values-') || s === 'buy' || s === 'hubs'
const norm = (u: string) => u.replace(/\/+$/, '').toLowerCase()
const pathOf = (u: string) => {
  try {
    return new URL(u).pathname
  } catch {
    return u
  }
}

export function alertsFor(input: {
  inspected: InspectionRow[]
  sectionsToday: SectionCount[]
  sectionsWeekAgo: SectionCount[]
  /** `${kind}|${url ?? section}` raised in the last ALERT_DEDUPE_DAYS days. */
  recent: ReadonlySet<string>
}): NewAlert[] {
  const out: NewAlert[] = []
  const push = (a: NewAlert) => {
    const key = `${a.kind}|${a.url ?? a.section}`
    if (input.recent.has(key) || out.some((x) => `${x.kind}|${x.url ?? x.section}` === key)) return
    out.push(a)
  }

  for (const r of input.inspected) {
    if (r.previousVerdict === 'PASS' && r.verdict && r.verdict !== 'PASS' && isMoneySection(r.section)) {
      push({
        kind: 'indexed-page-dropped',
        url: r.url,
        section: r.section,
        message: `Dropped out of Google: ${pathOf(r.url)} (${r.coverageState ?? r.verdict})`,
        details: { coverageState: r.coverageState, verdict: r.verdict },
      })
    }
    if (!r.inSitemap) continue
    if (r.robotsState === 'DISALLOWED') {
      push({ kind: 'robots-blocked', url: r.url, section: r.section, message: `robots.txt blocks ${pathOf(r.url)}`, details: {} })
    }
    if (r.pageFetchState && r.pageFetchState !== 'SUCCESSFUL' && r.pageFetchState !== 'PAGE_FETCH_STATE_UNSPECIFIED') {
      push({ kind: 'fetch-error', url: r.url, section: r.section, message: `Google could not fetch ${pathOf(r.url)}: ${r.pageFetchState}`, details: { pageFetchState: r.pageFetchState } })
    }
    if (r.googleCanonical && norm(r.googleCanonical) !== norm(r.url)) {
      push({
        kind: 'canonical-mismatch',
        url: r.url,
        section: r.section,
        message: `Google picked another canonical for ${pathOf(r.url)}: ${r.googleCanonical}`,
        details: { googleCanonical: r.googleCanonical, userCanonical: r.userCanonical },
      })
    }
  }

  const weekAgo = new Map(input.sectionsWeekAgo.map((s) => [s.section, s]))
  for (const today of input.sectionsToday) {
    const before = weekAgo.get(today.section)
    if (!before || today.inspected < MIN_SECTION_SAMPLE || before.inspected < MIN_SECTION_SAMPLE) continue
    const rateNow = today.indexed / today.inspected
    const rateThen = before.indexed / before.inspected
    if (rateThen > 0 && rateNow < rateThen * (1 - SECTION_DROP_RATIO)) {
      push({
        kind: 'section-index-rate-drop',
        url: null,
        section: today.section,
        message: `${today.section}: index rate ${(rateThen * 100).toFixed(0)}% → ${(rateNow * 100).toFixed(0)}% in a week`,
        details: { rateNow, rateThen, today, before },
      })
    }
  }
  return out
}

/** Per section: URLs in the sitemap, how many have an inspection, how many are indexed. */
export function sectionStats(
  sitemapBySection: ReadonlyMap<string, string[]>,
  verdictByUrl: ReadonlyMap<string, string | null>,
): (SectionCount & { sitemapUrls: number })[] {
  return [...sitemapBySection].map(([section, urls]) => {
    const verdicts = urls.map((u) => verdictByUrl.get(u)).filter((v): v is string => !!v)
    return { section, sitemapUrls: urls.length, inspected: verdicts.length, indexed: verdicts.filter((v) => v === 'PASS').length }
  })
}
