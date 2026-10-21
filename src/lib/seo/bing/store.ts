import type { createServiceRoleClient } from '@/lib/supabase/service'
import type { BingStore } from './sync'

type Db = ReturnType<typeof createServiceRoleClient>

const check = (res: { error: { message: string } | null }, what: string) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
}

/** BingStore over seo_bing_daily / seo_bing_pages / seo_bing_queries (service role). Upserts in chunks of 500. */
export function supabaseBingStore(db: Db): BingStore {
  const client = db as any
  const chunks = <T,>(rows: T[]) => Array.from({ length: Math.ceil(rows.length / 500) }, (_, i) => rows.slice(i * 500, i * 500 + 500))
  return {
    async upsertDaily(rows) {
      for (const c of chunks(rows)) {
        check(await client.from('seo_bing_daily').upsert(c.map((r) => ({ ...r, synced_at: new Date().toISOString() })), { onConflict: 'day' }), 'seo_bing_daily upsert')
      }
    },
    async upsertPages(rows) {
      for (const c of chunks(rows)) {
        check(
          await client
            .from('seo_bing_pages')
            .upsert(c.map((r) => ({ week: r.week, url: r.key, section: r.section, clicks: r.clicks, impressions: r.impressions, avg_position: r.avg_position })), { onConflict: 'week,url' }),
          'seo_bing_pages upsert',
        )
      }
    },
    async upsertQueries(rows) {
      for (const c of chunks(rows)) {
        check(
          await client
            .from('seo_bing_queries')
            .upsert(c.map((r) => ({ week: r.week, query: r.key, clicks: r.clicks, impressions: r.impressions, avg_position: r.avg_position })), { onConflict: 'week,query' }),
          'seo_bing_queries upsert',
        )
      }
    },
  }
}
