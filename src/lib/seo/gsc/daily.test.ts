import { describe, it, expect, vi } from 'vitest'
import { alertMessage, runDailyGscCheck, type GscStore, type InspectionWrite, type StoredInspection } from './daily'

const S = 'https://dropmarket.gg'
const NOW = new Date('2026-10-09T06:20:00Z')

function memoryStore(initial: StoredInspection[] = [], changed: string[] = []) {
  const inspections = new Map(initial.map((i) => [i.url, { ...i }]))
  const daily = new Map<string, any[]>()
  const alerts: any[] = []
  const events: any[] = []
  const store: GscStore = {
    loadInspections: async () => [...inspections.values()],
    changedUrlsSince: async () => changed,
    upsertInspections: async (rows: InspectionWrite[]) => {
      for (const r of rows) inspections.set(r.url, { ...(inspections.get(r.url) ?? { searchSyncedAt: null }), url: r.url, section: r.section, verdict: r.verdict, inspectedAt: r.inspectedAt })
    },
    markEventsInspected: async (rows) => void events.push(...rows),
    replaceSearch: async (rows, at) => {
      for (const r of rows) inspections.set(r.url, { ...(inspections.get(r.url) ?? { verdict: null, inspectedAt: null }), url: r.url, section: r.section, searchSyncedAt: at })
    },
    upsertSectionDaily: async (d, rows) => void daily.set(d, rows),
    sectionDaily: async (d) => daily.get(d) ?? [],
    recentAlertKeys: async () => new Set(alerts.map((a) => `${a.kind}|${a.url ?? a.section}`)),
    insertAlerts: async (rows) => rows.map((r) => alerts.push({ ...r, posted: false })),
    markAlertsPosted: async (ids) => ids.forEach((id) => (alerts[id - 1].posted = true)),
  }
  return { store, inspections, daily, alerts, events }
}

const indexed = (url: string) => ({ inspectionResult: { indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed', robotsTxtState: 'ALLOWED', pageFetchState: 'SUCCESSFUL', googleCanonical: url, userCanonical: url } } })
const dropped = (url: string) => ({ inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: 'Crawled - currently not indexed', robotsTxtState: 'ALLOWED', pageFetchState: 'SUCCESSFUL', googleCanonical: url, userCanonical: url } } })
const sitemap = new Map([
  ['values-adopt-me', [`${S}/adopt-me/values/bat-dragon`, `${S}/adopt-me/values/frost-dragon`]],
  ['static', [S]],
])

describe('runDailyGscCheck', () => {
  it('posts a Discord alert when an indexed money page drops out (the fake drop)', async () => {
    const m = memoryStore([{ url: `${S}/adopt-me/values/bat-dragon`, section: 'values-adopt-me', verdict: 'PASS', inspectedAt: '2026-10-01T00:00:00Z', searchSyncedAt: null }])
    const notify = vi.fn(async () => true)
    const api = {
      inspectUrl: vi.fn(async (url: string) => (url.endsWith('bat-dragon') ? dropped(url) : indexed(url))),
      searchAnalytics: vi.fn(async () => ({ rows: [{ keys: [`${S}/adopt-me/values/bat-dragon`], clicks: 3, impressions: 40 }] })),
    }
    const r = await runDailyGscCheck({ store: m.store, api, sitemap, now: NOW, budgetMs: 60_000, notify })
    expect(r.inspected).toBe(3)
    expect(r.alerts.map((a) => a.kind)).toEqual(['indexed-page-dropped'])
    expect(notify).toHaveBeenCalledTimes(1)
    expect(m.alerts[0].posted).toBe(true)
    expect(alertMessage(r.alerts, S)).toContain('Dropped out of Google: /adopt-me/values/bat-dragon')
    // Stored the day's index rate per section.
    expect(m.daily.get('2026-10-09')).toEqual(
      expect.arrayContaining([expect.objectContaining({ section: 'values-adopt-me', sitemapUrls: 2, inspected: 2, indexed: 1, clicks: 3 })]),
    )
  })

  it('inspects changed pages first, never re-inspects a page today, and respects the daily cap', async () => {
    const today = '2026-10-09T01:00:00Z'
    const m = memoryStore(
      [{ url: S, section: 'static', verdict: 'PASS', inspectedAt: today, searchSyncedAt: today }],
      [`${S}/adopt-me/values/frost-dragon`],
    )
    const api = { inspectUrl: vi.fn(async (url: string) => indexed(url)), searchAnalytics: vi.fn(async () => ({ rows: [] })) }
    await runDailyGscCheck({ store: m.store, api, sitemap, now: NOW, budgetMs: 60_000, notify: async () => true, concurrency: 1 })
    expect(api.inspectUrl.mock.calls.map((c) => c[0])).toEqual([`${S}/adopt-me/values/frost-dragon`, `${S}/adopt-me/values/bat-dragon`])
    // Search Analytics already synced today: not pulled again.
    expect(api.searchAnalytics).not.toHaveBeenCalled()
    expect(m.events.map((e) => e.url)).toEqual([`${S}/adopt-me/values/frost-dragon`])
  })

  it('stops cleanly when the daily quota runs out', async () => {
    const m = memoryStore()
    const quota = new Error('quota per day')
    const api = { inspectUrl: vi.fn(async () => { throw quota }), searchAnalytics: vi.fn(async () => ({ rows: [] })) }
    const r = await runDailyGscCheck({ store: m.store, api, sitemap, now: NOW, budgetMs: 60_000, notify: async () => true, concurrency: 1, isQuotaError: (e) => e === quota })
    expect(r).toMatchObject({ inspected: 0, quotaExhausted: true })
    expect(api.inspectUrl).toHaveBeenCalledTimes(1)
  })
})
