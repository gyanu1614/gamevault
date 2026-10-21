/**
 * Turn the four Bing calls into the rows /admin/seo reads, and store them.
 * Pure transforms (unit-tested) + one run function over a small store, so the
 * cron route is a thin wrapper. Bounded writes: the last 35 days of daily
 * rows, the last 8 weeks of top pages / queries, top 200 per week.
 */
import { sectionOfPath } from '@/lib/seo/gsc/check'
import { parseBingDate, type BingApi, type BingCrawlRow, type BingStatsRow, type BingTrafficRow } from './api'

export interface BingDailyRow {
  day: string
  clicks: number | null
  impressions: number | null
  crawled_pages: number | null
  crawl_errors: number | null
  in_index: number | null
  in_links: number | null
}
export interface BingWeeklyRow { week: string; key: string; clicks: number; impressions: number; avg_position: number | null }

const DAILY_DAYS = 35
const WEEKS = 8
const TOP_PER_WEEK = 200

const daysAgo = (now: Date, n: number) => new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10)
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null)

/** One row per day, traffic and crawl merged; only the last 35 days. */
export function toDailyRows(traffic: BingTrafficRow[], crawl: BingCrawlRow[], now = new Date()): BingDailyRow[] {
  const since = daysAgo(now, DAILY_DAYS)
  const byDay = new Map<string, BingDailyRow>()
  const row = (day: string) => {
    let r = byDay.get(day)
    if (!r) byDay.set(day, (r = { day, clicks: null, impressions: null, crawled_pages: null, crawl_errors: null, in_index: null, in_links: null }))
    return r
  }
  for (const t of traffic) {
    const day = parseBingDate(t.Date)
    if (!day || day < since) continue
    const r = row(day)
    r.clicks = int(t.Clicks)
    r.impressions = int(t.Impressions)
  }
  for (const c of crawl) {
    const day = parseBingDate(c.Date)
    if (!day || day < since) continue
    const r = row(day)
    r.crawled_pages = int(c.CrawledPages)
    r.crawl_errors = int(c.CrawlErrors)
    r.in_index = int(c.InIndex)
    r.in_links = int(c.InLinks)
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}

/** Top pages or queries per week (Bing buckets GetPageStats/GetQueryStats by week): last 8 weeks, top 200 by impressions each. */
export function toWeeklyRows(stats: BingStatsRow[], now = new Date()): BingWeeklyRow[] {
  const since = daysAgo(now, WEEKS * 7)
  const byWeek = new Map<string, Map<string, BingWeeklyRow>>()
  for (const s of stats) {
    const week = parseBingDate(s.Date)
    const key = (s.Query ?? '').trim()
    if (!week || week < since || !key) continue
    const rows = byWeek.get(week) ?? new Map<string, BingWeeklyRow>()
    const prev = rows.get(key)
    const clicks = (prev?.clicks ?? 0) + (int(s.Clicks) ?? 0)
    const impressions = (prev?.impressions ?? 0) + (int(s.Impressions) ?? 0)
    const pos = typeof s.AvgImpressionPosition === 'number' && s.AvgImpressionPosition > 0 ? Math.round(s.AvgImpressionPosition * 100) / 100 : prev?.avg_position ?? null
    rows.set(key, { week, key, clicks, impressions, avg_position: pos })
    byWeek.set(week, rows)
  }
  return [...byWeek.values()].flatMap((rows) => [...rows.values()].sort((a, b) => b.impressions - a.impressions).slice(0, TOP_PER_WEEK))
}

/** A page URL's section, the same buckets as the Google check ("values-adopt-me", "sell", "blog"…). */
export const sectionOfUrl = (url: string) => {
  try {
    return sectionOfPath(new URL(url).pathname)
  } catch {
    return 'static'
  }
}

export interface BingStore {
  upsertDaily(rows: BingDailyRow[]): Promise<void>
  upsertPages(rows: Array<BingWeeklyRow & { section: string }>): Promise<void>
  upsertQueries(rows: BingWeeklyRow[]): Promise<void>
}

export async function runBingSync(api: BingApi, store: BingStore, now = new Date()) {
  const [traffic, crawl, pages, queries] = [
    await api.get<BingTrafficRow>('GetRankAndTrafficStats'),
    await api.get<BingCrawlRow>('GetCrawlStats'),
    await api.get<BingStatsRow>('GetPageStats'),
    await api.get<BingStatsRow>('GetQueryStats'),
  ]
  const daily = toDailyRows(traffic, crawl, now)
  const pageRows = toWeeklyRows(pages, now).map((r) => ({ ...r, section: sectionOfUrl(r.key) }))
  const queryRows = toWeeklyRows(queries, now)
  await store.upsertDaily(daily)
  await store.upsertPages(pageRows)
  await store.upsertQueries(queryRows)
  return { days: daily.length, pages: pageRows.length, queries: queryRows.length }
}
