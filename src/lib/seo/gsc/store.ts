import { fetchAllRows } from '@/lib/seo/paged-read'

import type { GscStore } from './daily'

/** GscStore over seo_url_inspections / seo_url_events / seo_section_daily / seo_alerts (service role). */
type Db = any

export function supabaseGscStore(db: Db): GscStore {
  const check = (r: { error: { message: string } | null }, what: string) => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`)
  }
  return {
    async loadInspections() {
      const rows = await fetchAllRows<{ url: string; section: string; verdict: string | null; inspected_at: string | null; search_synced_at: string | null }>(
        (f, t) => db.from('seo_url_inspections').select('url, section, verdict, inspected_at, search_synced_at').order('url').range(f, t),
      )
      return rows.map((r) => ({ url: r.url, section: r.section, verdict: r.verdict, inspectedAt: r.inspected_at, searchSyncedAt: r.search_synced_at }))
    },
    async changedUrlsSince(iso) {
      const rows = await fetchAllRows<{ url: string; id: number }>((f, t) =>
        db.from('seo_url_events').select('id, url').gte('changed_at', iso).order('id').range(f, t),
      )
      return [...new Set(rows.map((r) => r.url))]
    },
    async upsertInspections(rows) {
      for (let i = 0; i < rows.length; i += 500) {
        check(
          await db.from('seo_url_inspections').upsert(
            rows.slice(i, i + 500).map((r) => ({
              url: r.url,
              section: r.section,
              verdict: r.verdict,
              previous_verdict: r.previousVerdict,
              coverage_state: r.coverageState,
              indexing_state: r.indexingState,
              robots_state: r.robotsState,
              page_fetch_state: r.pageFetchState,
              google_canonical: r.googleCanonical,
              user_canonical: r.userCanonical,
              last_crawl_at: r.lastCrawlAt,
              inspected_at: r.inspectedAt,
            })),
            { onConflict: 'url' },
          ),
          'seo_url_inspections upsert',
        )
      }
    },
    async markEventsInspected(rows) {
      for (const r of rows) {
        check(
          await db.from('seo_url_events').update({ gsc_state: r.gscState, last_inspected: r.at }).eq('url', r.url).gte('changed_at', r.since),
          'seo_url_events update',
        )
      }
    },
    async replaceSearch(rows, at) {
      for (let i = 0; i < rows.length; i += 500) {
        check(
          await db.from('seo_url_inspections').upsert(
            rows.slice(i, i + 500).map((r) => ({ url: r.url, section: r.section, clicks_90d: r.clicks, impressions_90d: r.impressions, search_synced_at: at })),
            { onConflict: 'url' },
          ),
          'seo_url_inspections search upsert',
        )
      }
      // Pages Google no longer reports clicks for: zero, so their protection lapses.
      check(
        await db
          .from('seo_url_inspections')
          .update({ clicks_90d: 0, impressions_90d: 0, search_synced_at: at })
          .or(`search_synced_at.is.null,search_synced_at.lt.${at}`),
        'seo_url_inspections search reset',
      )
    },
    async upsertSectionDaily(day, rows) {
      check(
        await db.from('seo_section_daily').upsert(
          rows.map((r) => ({ day, section: r.section, sitemap_urls: r.sitemapUrls, inspected: r.inspected, indexed: r.indexed, clicks: r.clicks, impressions: r.impressions })),
          { onConflict: 'day,section' },
        ),
        'seo_section_daily upsert',
      )
    },
    async sectionDaily(day) {
      const { data, error } = await db.from('seo_section_daily').select('section, inspected, indexed, clicks, impressions').eq('day', day)
      if (error) throw new Error(`seo_section_daily read: ${error.message}`)
      return data ?? []
    },
    async recentAlertKeys(sinceIso) {
      const { data, error } = await db.from('seo_alerts').select('kind, url, section').gte('created_at', sinceIso).limit(5000)
      if (error) throw new Error(`seo_alerts read: ${error.message}`)
      return new Set(((data ?? []) as { kind: string; url: string | null; section: string | null }[]).map((a) => `${a.kind}|${a.url ?? a.section}`))
    },
    async insertAlerts(alerts) {
      const { data, error } = await db
        .from('seo_alerts')
        .insert(alerts.map((a) => ({ kind: a.kind, url: a.url, section: a.section, message: a.message, details: a.details })))
        .select('id')
      if (error) throw new Error(`seo_alerts insert: ${error.message}`)
      return ((data ?? []) as { id: number }[]).map((r) => r.id)
    },
    async markAlertsPosted(ids, at) {
      if (ids.length === 0) return
      check(await db.from('seo_alerts').update({ posted_at: at }).in('id', ids), 'seo_alerts posted')
    },
  }
}
