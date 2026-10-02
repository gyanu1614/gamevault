/**
 * Read-only Search Console client: URL Inspection, Search Analytics queries and
 * the sitemaps list. There is deliberately no method that submits, deletes or
 * requests indexing — client.test.ts fails if one appears.
 */

import type { InspectionResponse } from './csv'
import { GscHttpError, parseRetryAfter, withBackoff, type BackoffOptions } from './throttle'
import type { FetchLike } from './types'

const INSPECT_URL = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect'
const WEBMASTERS = 'https://www.googleapis.com/webmasters/v3/sites'

export interface SearchAnalyticsBody {
  startDate: string
  endDate: string
  dimensions?: string[]
  type?: string
  dataState?: string
  rowLimit?: number
  startRow?: number
}

export interface SearchAnalyticsRow {
  keys?: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchAnalyticsResponse {
  rows: SearchAnalyticsRow[]
}

export interface SitemapEntry {
  path: string
  lastSubmitted: string
  lastDownloaded: string
  isPending: boolean
  isSitemapsIndex: boolean
  type: string
  warnings: number
  errors: number
  contents: { type: string; submitted: number; indexed: number }[]
}

export interface GscClientOptions {
  fetch: FetchLike
  getToken: () => Promise<string>
  throttle: { wait: () => Promise<void> }
  sleep: (ms: number) => Promise<void>
  siteUrl: string
  backoff?: Partial<Omit<BackoffOptions, 'sleep'>>
}

const toNumber = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function errorMessage(status: number, text: string, siteUrl: string): string {
  let detail = text.slice(0, 300)
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string }
    const msg = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message
    if (msg) detail = msg
  } catch {
    /* keep the raw (truncated) body */
  }
  const hint =
    status === 403 || status === 401
      ? ` — the service account must be added as a user on the Search Console property ${siteUrl}`
      : ''
  return `Search Console API HTTP ${status}: ${detail}${hint}`
}

export function createGscClient(opts: GscClientOptions) {
  const { fetch, getToken, throttle, sleep, siteUrl, backoff } = opts
  const site = `${WEBMASTERS}/${encodeURIComponent(siteUrl)}`

  async function request<T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
    return withBackoff(
      async () => {
        await throttle.wait()
        const token = await getToken()
        let res: Response
        try {
          res = await fetch(url, {
            method,
            headers: {
              authorization: `Bearer ${token}`,
              ...(body === undefined ? {} : { 'content-type': 'application/json' }),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
          })
        } catch (err) {
          throw new GscHttpError(0, `Network error calling Search Console: ${(err as Error).message}`)
        }
        const text = await res.text()
        if (!res.ok) {
          throw new GscHttpError(res.status, errorMessage(res.status, text, siteUrl), {
            retryAfterMs: parseRetryAfter(res.headers.get('retry-after'), Date.now()),
          })
        }
        return (text ? JSON.parse(text) : {}) as T
      },
      { ...backoff, sleep },
    )
  }

  return {
    inspectUrl(url: string): Promise<InspectionResponse> {
      return request('POST', INSPECT_URL, { inspectionUrl: url, siteUrl, languageCode: 'en-US' })
    },

    async searchAnalytics(body: SearchAnalyticsBody): Promise<SearchAnalyticsResponse> {
      const res = await request<Partial<SearchAnalyticsResponse>>('POST', `${site}/searchAnalytics/query`, body)
      return { rows: res.rows ?? [] }
    },

    async listSitemaps(): Promise<SitemapEntry[]> {
      const res = await request<{ sitemap?: Record<string, any>[] }>('GET', `${site}/sitemaps`)
      return (res.sitemap ?? []).map((s) => ({
        path: s.path ?? '',
        lastSubmitted: s.lastSubmitted ?? '',
        lastDownloaded: s.lastDownloaded ?? '',
        isPending: Boolean(s.isPending),
        isSitemapsIndex: Boolean(s.isSitemapsIndex),
        type: s.type ?? '',
        warnings: toNumber(s.warnings),
        errors: toNumber(s.errors),
        contents: (s.contents ?? []).map((c: Record<string, unknown>) => ({
          type: String(c.type ?? ''),
          submitted: toNumber(c.submitted),
          indexed: toNumber(c.indexed),
        })),
      }))
    },
  }
}
