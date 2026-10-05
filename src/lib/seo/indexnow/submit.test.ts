import { describe, it, expect, vi } from 'vitest'

import { CHUNK_SIZE, INDEXNOW_KEY, normaliseUrls, submitIndexNow } from '@/lib/seo/indexnow/submit'

const SITE = 'https://dropmarket.gg'
const ok = (status = 202) => vi.fn(async () => ({ status }) as Response)
const urls = (n: number) => Array.from({ length: n }, (_, i) => `/valorant/buy-vp/listing-${i}`)

describe('normaliseUrls', () => {
  it('turns paths into absolute URLs on the site, with the bare origin for "/"', () => {
    expect(normaliseUrls(['/valorant', 'adopt-me/values', '/'], SITE).urls).toEqual([
      `${SITE}/valorant`,
      `${SITE}/adopt-me/values`,
      SITE,
    ])
  })
  it('keeps absolute URLs on the site and drops the query, fragment and trailing slash', () => {
    expect(normaliseUrls([`${SITE}/browse/?utm_source=x#top`], SITE).urls).toEqual([`${SITE}/browse`])
  })
  it('rejects any other host (IndexNow answers 422 for a mixed list)', () => {
    const r = normaliseUrls(['https://evil.example/x', '/ok'], SITE)
    expect(r.urls).toEqual([`${SITE}/ok`])
    expect(r.rejected).toEqual(['https://evil.example/x'])
  })
  it('removes duplicates and blanks, keeping order', () => {
    expect(normaliseUrls(['/a', '/b', '/a', '', '  ', `${SITE}/a`], SITE).urls).toEqual([`${SITE}/a`, `${SITE}/b`])
  })
})

describe('submitIndexNow', () => {
  it('does nothing outside production (dev and preview must not advertise canonical URLs)', async () => {
    const fetchImpl = ok()
    const r = await submitIndexNow(['/valorant'], { reason: 't', fetchImpl, production: false, log: () => {} })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(r).toMatchObject({ submitted: 0, skipped: 'not-production' })
  })

  it('does nothing for an empty list', async () => {
    const fetchImpl = ok()
    const r = await submitIndexNow([], { reason: 't', fetchImpl, production: true, log: () => {} })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(r.skipped).toBe('empty')
  })

  it('posts the key, its location and the absolute URLs to the shared endpoint', async () => {
    const fetchImpl = ok(200)
    await submitIndexNow(['/valorant/buy-vp'], { reason: 'listing-published', fetchImpl, production: true, siteUrl: SITE, log: () => {} })
    const [endpoint, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(endpoint).toBe('https://api.indexnow.org/indexnow')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      host: 'dropmarket.gg',
      key: INDEXNOW_KEY,
      keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
      urlList: [`${SITE}/valorant/buy-vp`],
    })
  })

  it('sends at most CHUNK_SIZE URLs per request, never one big batch', async () => {
    expect(CHUNK_SIZE).toBe(100)
    const fetchImpl = ok()
    const r = await submitIndexNow(urls(250), { reason: 't', fetchImpl, production: true, siteUrl: SITE, log: () => {} })
    const sizes = fetchImpl.mock.calls.map((c) => JSON.parse(((c as unknown as [string, RequestInit])[1].body as string)).urlList.length)
    expect(sizes).toEqual([100, 100, 50])
    expect(r).toMatchObject({ submitted: 250, chunks: 3, failures: 0 })
  })

  it('de-duplicates before chunking', async () => {
    const fetchImpl = ok()
    const r = await submitIndexNow(['/a', '/a', '/b'], { reason: 't', fetchImpl, production: true, siteUrl: SITE, log: () => {} })
    expect(r.submitted).toBe(2)
  })

  it('logs one line per chunk with the reason, size and status', async () => {
    const lines: string[] = []
    await submitIndexNow(urls(150), { reason: 'value-change:adopt-me', fetchImpl: ok(202), production: true, siteUrl: SITE, log: (l) => lines.push(l) })
    expect(lines).toEqual([
      '[indexnow] reason=value-change:adopt-me chunk=1/2 urls=100 status=202',
      '[indexnow] reason=value-change:adopt-me chunk=2/2 urls=50 status=202',
    ])
  })

  it.each([400, 403, 422, 429])('counts HTTP %s as a failure and says so', async (status) => {
    const lines: string[] = []
    const r = await submitIndexNow(['/a'], { reason: 't', fetchImpl: ok(status), production: true, siteUrl: SITE, log: (l) => lines.push(l) })
    expect(r.failures).toBe(1)
    expect(lines[0]).toContain(`status=${status}`)
    expect(lines[0]).toContain('FAILED')
  })

  it('never throws: a network error fails that chunk and the rest still go out', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue({ status: 202 } as Response)
    const r = await submitIndexNow(urls(150), { reason: 't', fetchImpl, production: true, siteUrl: SITE, log: () => {} })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(r).toMatchObject({ chunks: 2, failures: 1, submitted: 50 })
  })

  it('caps each request with a timeout so a slow endpoint cannot stall a publish', async () => {
    const fetchImpl = ok()
    await submitIndexNow(['/a'], { reason: 't', fetchImpl, production: true, siteUrl: SITE, log: () => {} })
    expect((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].signal).toBeInstanceOf(AbortSignal)
  })
})
