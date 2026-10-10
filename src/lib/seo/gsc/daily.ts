import { alertsFor, DAILY_INSPECTION_CAP, pickInspectionTargets, sectionOfPath, sectionStats, ALERT_DEDUPE_DAYS, type InspectionRow, type NewAlert } from './check'

/**
 * The daily Google check (cron /api/cron/seo-gsc):
 *  1. inspect the URLs logged as changed in the last 72 h, then a rotating
 *     sample of the sitemap — at most DAILY_INSPECTION_CAP a day, within the
 *     run's time budget (a re-run the same day continues where it stopped);
 *  2. once a day, pull Search Analytics per page (90 days: clicks protect a page
 *     from the data gate; 28 days: clicks per section);
 *  3. store the index rate per section for the day;
 *  4. raise alerts (indexed money page dropped, section index rate down >10%
 *     week on week, robots/fetch/canonical problems) and post the new ones.
 * All storage is behind GscStore (./store.ts is the table-backed one).
 */
export interface StoredInspection {
  url: string
  section: string
  verdict: string | null
  inspectedAt: string | null
  searchSyncedAt: string | null
}

export interface InspectionWrite {
  url: string
  section: string
  verdict: string | null
  previousVerdict: string | null
  coverageState: string | null
  indexingState: string | null
  robotsState: string | null
  pageFetchState: string | null
  googleCanonical: string | null
  userCanonical: string | null
  lastCrawlAt: string | null
  inspectedAt: string
}

export interface GscStore {
  loadInspections(): Promise<StoredInspection[]>
  changedUrlsSince(iso: string): Promise<string[]>
  upsertInspections(rows: InspectionWrite[]): Promise<void>
  markEventsInspected(rows: { url: string; gscState: string | null; at: string; since: string }[]): Promise<void>
  /** Clicks per page; rows not in `rows` get zero (a page that lost its clicks loses its protection). */
  replaceSearch(rows: { url: string; section: string; clicks: number; impressions: number }[], at: string): Promise<void>
  upsertSectionDaily(day: string, rows: { section: string; sitemapUrls: number; inspected: number; indexed: number; clicks: number; impressions: number }[]): Promise<void>
  sectionDaily(day: string): Promise<{ section: string; inspected: number; indexed: number; clicks: number; impressions: number }[]>
  recentAlertKeys(sinceIso: string): Promise<Set<string>>
  insertAlerts(alerts: NewAlert[]): Promise<number[]>
  markAlertsPosted(ids: number[], at: string): Promise<void>
}

export interface InspectionResult {
  inspectionResult?: {
    indexStatusResult?: {
      verdict?: string
      coverageState?: string
      indexingState?: string
      robotsTxtState?: string
      pageFetchState?: string
      lastCrawlTime?: string
      googleCanonical?: string
      userCanonical?: string
    }
  }
}

export interface GscApi {
  inspectUrl(url: string): Promise<InspectionResult>
  searchAnalytics(body: Record<string, unknown>): Promise<{ rows: { keys?: string[]; clicks?: number; impressions?: number }[] }>
}

export interface DailySummary {
  inspected: number
  inspectionErrors: number
  quotaExhausted: boolean
  searchSynced: boolean
  alerts: NewAlert[]
  posted: number
  sections: { section: string; sitemapUrls: number; inspected: number; indexed: number }[]
}

const day = (d: Date) => d.toISOString().slice(0, 10)
const daysBefore = (d: Date, n: number) => new Date(d.getTime() - n * 86_400_000)

export async function runDailyGscCheck(deps: {
  store: GscStore
  api: GscApi
  /** Sitemap section → its URLs. */
  sitemap: ReadonlyMap<string, string[]>
  now: Date
  /** Stop starting new inspections after this many ms. */
  budgetMs: number
  concurrency?: number
  notify: (alerts: NewAlert[]) => Promise<boolean>
  isQuotaError?: (e: unknown) => boolean
}): Promise<DailySummary> {
  const { store, api, now } = deps
  const started = Date.now()
  const todayStart = `${day(now)}T00:00:00.000Z`
  const since72h = daysBefore(now, 3).toISOString()

  const sectionByUrl = new Map<string, string>()
  for (const [section, urls] of deps.sitemap) for (const u of urls) sectionByUrl.set(u, section)
  const sectionOf = (url: string) => sectionByUrl.get(url) ?? sectionOfPath(new URL(url).pathname)

  const [stored, changed] = await Promise.all([store.loadInspections(), store.changedUrlsSince(since72h)])
  const byUrl = new Map(stored.map((s) => [s.url, s]))
  const lastInspected = new Map(stored.filter((s) => s.inspectedAt).map((s) => [s.url, s.inspectedAt!]))
  const usedToday = stored.filter((s) => (s.inspectedAt ?? '') >= todayStart).length

  // 1. Inspect.
  const targets = pickInspectionTargets({
    changed,
    sitemap: [...sectionByUrl.keys()],
    lastInspected,
    todayStart,
    remaining: DAILY_INSPECTION_CAP - usedToday,
  })
  const writes: InspectionWrite[] = []
  let errors = 0
  let quotaExhausted = false
  let next = 0
  await Promise.all(
    Array.from({ length: deps.concurrency ?? 8 }, async () => {
      while (next < targets.length && !quotaExhausted && Date.now() - started < deps.budgetMs) {
        const url = targets[next++]
        try {
          const s = (await api.inspectUrl(url)).inspectionResult?.indexStatusResult ?? {}
          writes.push({
            url,
            section: sectionOf(url),
            verdict: s.verdict ?? null,
            previousVerdict: byUrl.get(url)?.verdict ?? null,
            coverageState: s.coverageState ?? null,
            indexingState: s.indexingState ?? null,
            robotsState: s.robotsTxtState ?? null,
            pageFetchState: s.pageFetchState ?? null,
            googleCanonical: s.googleCanonical ?? null,
            userCanonical: s.userCanonical ?? null,
            lastCrawlAt: s.lastCrawlTime ?? null,
            inspectedAt: new Date().toISOString(),
          })
        } catch (e) {
          if (deps.isQuotaError?.(e)) quotaExhausted = true
          else errors += 1
        }
      }
    }),
  )
  if (writes.length > 0) {
    await store.upsertInspections(writes)
    const changedSet = new Set(changed)
    await store.markEventsInspected(
      writes.filter((w) => changedSet.has(w.url)).map((w) => ({ url: w.url, gscState: w.coverageState, at: w.inspectedAt, since: since72h })),
    )
  }

  // 2. Search Analytics, once a day.
  const searchSynced = stored.some((s) => (s.searchSyncedAt ?? '') >= todayStart)
  let clicksBySection = new Map<string, { clicks: number; impressions: number }>()
  let didSync = false
  if (!searchSynced) {
    const query = (days: number) =>
      api.searchAnalytics({ startDate: day(daysBefore(now, days)), endDate: day(daysBefore(now, 1)), dimensions: ['page'], rowLimit: 25000 })
    const [d90, d28] = await Promise.all([query(90), query(28)])
    await store.replaceSearch(
      d90.rows
        .filter((r) => r.keys?.[0])
        .map((r) => ({ url: r.keys![0].replace(/\/$/, '') || r.keys![0], section: sectionOf(r.keys![0]), clicks: r.clicks ?? 0, impressions: r.impressions ?? 0 })),
      now.toISOString(),
    )
    clicksBySection = new Map()
    for (const r of d28.rows) {
      if (!r.keys?.[0]) continue
      const s = sectionOf(r.keys[0])
      const prev = clicksBySection.get(s) ?? { clicks: 0, impressions: 0 }
      clicksBySection.set(s, { clicks: prev.clicks + (r.clicks ?? 0), impressions: prev.impressions + (r.impressions ?? 0) })
    }
    didSync = true
  }

  // 3. Index rate per section, today.
  const verdictByUrl = new Map<string, string | null>(stored.map((s) => [s.url, s.verdict]))
  for (const w of writes) verdictByUrl.set(w.url, w.verdict)
  const stats = sectionStats(deps.sitemap as ReadonlyMap<string, string[]>, verdictByUrl)
  const today = day(now)
  const previousToday = didSync ? [] : await store.sectionDaily(today)
  await store.upsertSectionDaily(
    today,
    stats.map((s) => {
      const c = clicksBySection.get(s.section)
      // A second run the same day keeps the morning's Search Analytics numbers.
      const kept = previousToday.find((p) => p.section === s.section)
      return { ...s, clicks: c?.clicks ?? kept?.clicks ?? 0, impressions: c?.impressions ?? kept?.impressions ?? 0 }
    }),
  )

  // 4. Alerts.
  const inspectedRows: InspectionRow[] = writes.map((w) => ({
    url: w.url,
    section: w.section,
    verdict: w.verdict,
    previousVerdict: w.previousVerdict,
    coverageState: w.coverageState,
    robotsState: w.robotsState,
    pageFetchState: w.pageFetchState,
    googleCanonical: w.googleCanonical,
    userCanonical: w.userCanonical,
    inSitemap: sectionByUrl.has(w.url),
  }))
  const [weekAgo, recent] = await Promise.all([
    store.sectionDaily(day(daysBefore(now, 7))),
    store.recentAlertKeys(daysBefore(now, ALERT_DEDUPE_DAYS).toISOString()),
  ])
  const alerts = alertsFor({ inspected: inspectedRows, sectionsToday: stats, sectionsWeekAgo: weekAgo, recent })
  let posted = 0
  if (alerts.length > 0) {
    const ids = await store.insertAlerts(alerts)
    if (await deps.notify(alerts)) {
      await store.markAlertsPosted(ids, new Date().toISOString())
      posted = ids.length
    }
  }

  return { inspected: writes.length, inspectionErrors: errors, quotaExhausted, searchSynced: didSync, alerts, posted, sections: stats }
}

/** The Discord message for a batch of alerts (one post, at most 15 lines). */
export function alertMessage(alerts: NewAlert[], siteUrl: string): string {
  const lines = alerts.slice(0, 15).map((a) => `• ${a.message}`)
  const more = alerts.length > 15 ? `\n…and ${alerts.length - 15} more on ${siteUrl}/admin/seo` : ''
  return `**SEO check: ${alerts.length} new alert${alerts.length === 1 ? '' : 's'}**\n${lines.join('\n')}${more}`
}
