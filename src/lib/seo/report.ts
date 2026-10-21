import 'server-only'
import type { createServiceRoleClient } from '@/lib/supabase/service'
import { bingWeek, type BingDay, type GoogleTotals, type WeeklyCheck } from './weekly'

type Db = ReturnType<typeof createServiceRoleClient>

export interface SectionFunnel {
  section: string
  sitemapUrls: number
  indexed: number
  crawled: number
  discovered: number
  unknown: number
  clicks28d: number
  impressions28d: number
  indexedWeekAgo: number | null
  clicks28dWeekAgo: number | null
}

export interface SeoReport {
  day: string | null
  weekly: WeeklyCheck
  sections: SectionFunnel[]
  bingDays: BingDay[]
  bingQueries: Array<{ query: string; clicks: number; impressions: number; avgPosition: number | null; clicksPrevWeek: number | null }>
}

type SectionRow = { section: string; sitemap_urls: number; indexed: number; crawled: number; discovered: number; unknown: number; clicks: number; impressions: number }

const totals = (rows: SectionRow[]): GoogleTotals => ({
  indexed: rows.reduce((a, r) => a + r.indexed, 0),
  crawled: rows.reduce((a, r) => a + (r.crawled ?? 0), 0),
  discovered: rows.reduce((a, r) => a + (r.discovered ?? 0), 0),
  unknown: rows.reduce((a, r) => a + (r.unknown ?? 0), 0),
  clicks28d: rows.reduce((a, r) => a + r.clicks, 0),
  impressions28d: rows.reduce((a, r) => a + r.impressions, 0),
})

/**
 * Everything the weekly check needs, from the small daily tables only: two
 * days of seo_section_daily (~15 rows each), 35 days of seo_bing_daily, two
 * weeks of top pages / queries. A handful of indexed reads — no scans.
 */
export async function readSeoReport(db: Db): Promise<SeoReport> {
  const client = db as any
  const latest = await client.from('seo_section_daily').select('day').order('day', { ascending: false }).limit(1).maybeSingle()
  if (latest.error) throw new Error(`seo_section_daily: ${latest.error.message}`)
  const day: string | null = latest.data?.day ?? null
  const weekAgo = day ? new Date(Date.parse(day) - 7 * 86_400_000).toISOString().slice(0, 10) : null
  const cols = 'section, sitemap_urls, indexed, crawled, discovered, unknown, clicks, impressions'

  const [today, before, bing, weeks] = await Promise.all([
    day ? client.from('seo_section_daily').select(cols).eq('day', day).order('section') : { data: [], error: null },
    weekAgo ? client.from('seo_section_daily').select(cols).eq('day', weekAgo) : { data: [], error: null },
    client.from('seo_bing_daily').select('day, clicks, impressions, in_index').order('day', { ascending: false }).limit(35),
    client.from('seo_bing_pages').select('week').order('week', { ascending: false }).limit(1).maybeSingle(),
  ])
  for (const r of [today, before, bing, weeks]) if (r.error) throw new Error(`seo report read: ${r.error.message}`)

  const todayRows = (today.data ?? []) as SectionRow[]
  const beforeRows = (before.data ?? []) as SectionRow[]
  const prevBySection = new Map(beforeRows.map((r) => [r.section, r]))
  const sections: SectionFunnel[] = todayRows.map((r) => ({
    section: r.section,
    sitemapUrls: r.sitemap_urls,
    indexed: r.indexed,
    crawled: r.crawled ?? 0,
    discovered: r.discovered ?? 0,
    unknown: r.unknown ?? 0,
    clicks28d: r.clicks,
    impressions28d: r.impressions,
    indexedWeekAgo: prevBySection.get(r.section)?.indexed ?? null,
    clicks28dWeekAgo: prevBySection.get(r.section)?.clicks ?? null,
  }))

  // Top pages / queries: the latest week Bing reported, against the week before.
  const week: string | null = weeks.data?.week ?? null
  const prevWeek = week ? new Date(Date.parse(week) - 7 * 86_400_000).toISOString().slice(0, 10) : null
  const [pagesNow, pagesPrev, queriesNow, queriesPrev] = week
    ? await Promise.all([
        client.from('seo_bing_pages').select('url, clicks, impressions').eq('week', week).order('clicks', { ascending: false }).limit(10),
        client.from('seo_bing_pages').select('url, clicks').eq('week', prevWeek).order('clicks', { ascending: false }).limit(200),
        client.from('seo_bing_queries').select('query, clicks, impressions, avg_position').eq('week', week).order('clicks', { ascending: false }).limit(10),
        client.from('seo_bing_queries').select('query, clicks').eq('week', prevWeek).order('clicks', { ascending: false }).limit(200),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]
  const prevPage = new Map(((pagesPrev.data ?? []) as { url: string; clicks: number }[]).map((p) => [p.url, p.clicks]))
  const prevQuery = new Map(((queriesPrev.data ?? []) as { query: string; clicks: number }[]).map((q) => [q.query, q.clicks]))

  const bingDays = ((bing.data ?? []) as BingDay[]).slice().reverse()
  return {
    day,
    sections,
    bingDays,
    weekly: {
      google: { now: totals(todayRows), weekAgo: beforeRows.length ? totals(beforeRows) : null },
      bing: bingWeek(bingDays),
      topBingPages: ((pagesNow.data ?? []) as { url: string; clicks: number; impressions: number }[]).map((p) => ({
        url: p.url,
        clicks: p.clicks,
        impressions: p.impressions,
        clicksPrevWeek: prevPage.get(p.url) ?? null,
      })),
    },
    bingQueries: ((queriesNow.data ?? []) as { query: string; clicks: number; impressions: number; avg_position: number | null }[]).map((q) => ({
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      avgPosition: q.avg_position == null ? null : Number(q.avg_position),
      clicksPrevWeek: prevQuery.get(q.query) ?? null,
    })),
  }
}
