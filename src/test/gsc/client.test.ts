import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { createGscClient } from '../../../scripts/lib/gsc/client'
import { GscHttpError, QuotaExhaustedError } from '../../../scripts/lib/gsc/throttle'
import { blockNetwork } from './no-network'

blockNetwork()

const SITE = 'sc-domain:dropmarket.gg'

type Reply = Response | Error
function setup(replies: Reply[]) {
  const queue = [...replies]
  const calls: { url: string; init: RequestInit }[] = []
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init })
    const next = queue.shift()
    if (!next) throw new Error('fake fetch: no reply queued')
    if (next instanceof Error) throw next
    return next
  })
  const throttle = { wait: vi.fn(async () => {}) }
  const sleep = vi.fn(async (_ms: number) => {})
  const client = createGscClient({
    fetch,
    getToken: async () => 'tok-secret',
    throttle,
    sleep,
    siteUrl: SITE,
    backoff: { random: () => 1 },
  })
  return { client, calls, throttle, sleep, fetch }
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init })

describe('inspectUrl', () => {
  it('POSTs the URL and property to the URL Inspection endpoint with a bearer token', async () => {
    const reply = { inspectionResult: { indexStatusResult: { verdict: 'PASS' } } }
    const { client, calls } = setup([json(reply)])
    await expect(client.inspectUrl('https://dropmarket.gg/adopt-me')).resolves.toEqual(reply)

    expect(calls[0].url).toBe('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      inspectionUrl: 'https://dropmarket.gg/adopt-me',
      siteUrl: SITE,
      languageCode: 'en-US',
    })
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer tok-secret')
  })
})

describe('searchAnalytics', () => {
  it('POSTs to the property-scoped query endpoint with the body untouched', async () => {
    const { client, calls } = setup([json({ rows: [{ keys: ['q'], clicks: 1, impressions: 2, ctr: 0.5, position: 3 }] })])
    const body = { startDate: '2026-09-01', endDate: '2026-09-28', dimensions: ['query'], rowLimit: 100 }
    const res = await client.searchAnalytics(body)

    expect(calls[0].url).toBe(
      'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Adropmarket.gg/searchAnalytics/query',
    )
    expect(JSON.parse(String(calls[0].init.body))).toEqual(body)
    expect(res.rows).toHaveLength(1)
  })

  it('returns an empty row list when Google omits rows (no data)', async () => {
    const { client } = setup([json({})])
    await expect(client.searchAnalytics({ startDate: 'a', endDate: 'b' })).resolves.toEqual({ rows: [] })
  })
})

describe('listSitemaps', () => {
  it('GETs the sitemaps list and coerces int64 counts to numbers', async () => {
    const { client, calls } = setup([
      json({
        sitemap: [
          {
            path: 'https://dropmarket.gg/sitemap.xml',
            lastSubmitted: '2026-09-01T00:00:00Z',
            lastDownloaded: '2026-09-30T00:00:00Z',
            isPending: false,
            isSitemapsIndex: false,
            type: 'sitemap',
            warnings: '2',
            errors: '0',
            contents: [{ type: 'web', submitted: '1025', indexed: '0' }],
          },
        ],
      }),
    ])
    const [entry] = await client.listSitemaps()

    expect(calls[0].url).toBe('https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Adropmarket.gg/sitemaps')
    expect(calls[0].init.method).toBe('GET')
    expect(entry.warnings).toBe(2)
    expect(entry.errors).toBe(0)
    expect(entry.contents[0]).toEqual({ type: 'web', submitted: 1025, indexed: 0 })
  })

  it('returns [] when the property has no sitemaps', async () => {
    const { client } = setup([json({})])
    await expect(client.listSitemaps()).resolves.toEqual([])
  })
})

describe('retry behaviour', () => {
  it('retries 429 and 5xx through the throttle each time', async () => {
    const { client, throttle, sleep } = setup([
      new Response('{"error":{"message":"slow down"}}', { status: 429 }),
      new Response('{"error":{"message":"backend"}}', { status: 503 }),
      json({ inspectionResult: {} }),
    ])
    await client.inspectUrl('https://dropmarket.gg/')
    expect(throttle.wait).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000])
  })

  it('retries a network failure (status 0)', async () => {
    const { client, fetch } = setup([new TypeError('fetch failed'), json({ inspectionResult: {} })])
    await client.inspectUrl('https://dropmarket.gg/')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('honours the Retry-After header', async () => {
    const { client, sleep } = setup([
      new Response('{}', { status: 429, headers: { 'retry-after': '9' } }),
      json({ inspectionResult: {} }),
    ])
    await client.inspectUrl('https://dropmarket.gg/')
    expect(sleep).toHaveBeenCalledWith(9000)
  })

  it('stops on a per-day quota 429', async () => {
    const { client, fetch } = setup([
      new Response('{"error":{"message":"Quota exceeded for quota metric Queries per day"}}', { status: 429 }),
    ])
    await expect(client.inspectUrl('https://dropmarket.gg/')).rejects.toBeInstanceOf(QuotaExhaustedError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry a 400 and surfaces Google’s message', async () => {
    const { client, fetch } = setup([
      new Response('{"error":{"message":"URL is not part of this property"}}', { status: 400 }),
    ])
    const err = await client.inspectUrl('https://other.example/').catch((e) => e)
    expect(err).toBeInstanceOf(GscHttpError)
    expect(err.status).toBe(400)
    expect(err.message).toContain('URL is not part of this property')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('explains a 403 as a missing property grant', async () => {
    const { client } = setup([new Response('{"error":{"message":"forbidden"}}', { status: 403 })])
    const err = await client.listSitemaps().catch((e) => e)
    expect(err.status).toBe(403)
    expect(err.message).toContain(SITE)
    expect(err.message).toMatch(/service account/i)
  })

  it('never puts the bearer token in an error', async () => {
    const { client } = setup([new Response('nope', { status: 400 })])
    const err = await client.inspectUrl('https://dropmarket.gg/').catch((e) => e)
    expect(String(err.message)).not.toContain('tok-secret')
  })
})

describe('read-only guard', () => {
  const LIB_DIR = join(__dirname, '../../../scripts/lib/gsc')
  const sources = readdirSync(LIB_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ f, text: readFileSync(join(LIB_DIR, f), 'utf8') }))

  it('only ever issues GET/POST to the three read endpoints', async () => {
    const { client, calls } = setup([json({}), json({}), json({})])
    await client.inspectUrl('https://dropmarket.gg/')
    await client.searchAnalytics({ startDate: 'a', endDate: 'b' })
    await client.listSitemaps()
    const seen = calls.map((c) => `${c.init.method} ${new URL(c.url).pathname}`)
    expect(seen).toEqual([
      'POST /v1/urlInspection/index:inspect',
      'POST /webmasters/v3/sites/sc-domain%3Adropmarket.gg/searchAnalytics/query',
      'GET /webmasters/v3/sites/sc-domain%3Adropmarket.gg/sitemaps',
    ])
  })

  it('contains no code path that mutates Search Console', () => {
    for (const { f, text } of sources) {
      expect(text, `${f} must not use PUT/DELETE/PATCH`).not.toMatch(/method:\s*['"](PUT|DELETE|PATCH)['"]/)
      expect(text, `${f} must not touch the Indexing API`).not.toMatch(/urlNotifications|indexing\.googleapis/i)
      expect(text, `${f} must not request a write scope`).not.toMatch(/auth\/webmasters['"`]/)
    }
  })
})
