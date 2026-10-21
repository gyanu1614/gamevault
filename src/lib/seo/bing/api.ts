/**
 * Bing Webmaster Tools API (JSON endpoint), read only. Four calls a day feed
 * /admin/seo: GetRankAndTrafficStats (daily clicks + impressions),
 * GetCrawlStats (daily pages crawled, crawl errors, pages in index, inbound
 * links), GetPageStats and GetQueryStats (top pages / queries per week).
 *
 * Auth is an API key the owner generates in Bing Webmaster Tools → Settings →
 * API Access (env BING_WEBMASTER_API_KEY). Unset → no client, and the cron
 * skips cleanly. The key is never logged.
 */
import { SITE_URL } from '@/config/site'

export const BING_API = 'https://ssl.bing.com/webmaster/api.svc/json'

export interface BingTrafficRow { Date: string; Clicks: number; Impressions: number }
export interface BingCrawlRow { Date: string; CrawledPages?: number; CrawlErrors?: number; InIndex?: number; InLinks?: number }
export interface BingStatsRow { Date: string; Query: string; Clicks: number; Impressions: number; AvgImpressionPosition?: number; AvgClickPosition?: number }

export interface BingApi {
  get<T>(method: 'GetRankAndTrafficStats' | 'GetCrawlStats' | 'GetPageStats' | 'GetQueryStats'): Promise<T[]>
}

/**
 * "/Date(1697785200000-0700)/" → "2023-10-20": Bing stamps each row at local
 * midnight of the site's zone, so the offset is applied before taking the day.
 */
export function parseBingDate(v: unknown): string | null {
  const m = typeof v === 'string' ? v.match(/Date\((-?\d+)([+-]\d{4})?\)/) : null
  if (!m) return null
  const ms = Number(m[1])
  const off = m[2] ? (Number(m[2].slice(0, 3)) * 60 + Math.sign(Number(m[2].slice(0, 3)) || 1) * Number(m[2].slice(3))) * 60_000 : 0
  const d = new Date(ms + off)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export function bingApiFromEnv(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): BingApi | null {
  const key = env.BING_WEBMASTER_API_KEY
  if (!key) return null
  const siteUrl = env.BING_SITE_URL ?? `${SITE_URL}/`
  return {
    async get<T>(method: string): Promise<T[]> {
      const url = `${BING_API}/${method}?siteUrl=${encodeURIComponent(siteUrl)}&apikey=${encodeURIComponent(key)}`
      const res = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
      if (!res.ok) throw new Error(`Bing ${method} answered ${res.status}`)
      const body = (await res.json()) as { d?: T[] }
      return Array.isArray(body.d) ? body.d : []
    },
  }
}
