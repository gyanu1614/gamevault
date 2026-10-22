import { describe, it, expect, vi } from 'vitest'
import { MEDIA_CACHE_CONTROL, proxyMedia } from './media-proxy'

const SB = 'https://abcd.supabase.co'
const OBJECT = `${SB}/storage/v1/object/public`

// What Supabase Storage really answers (2026-10-22): Cloudflare's bot cookie on
// every response, plus its own cache and robots headers.
function storageResponse(body: BodyInit | null, status = 200, extra: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'image/webp',
      'content-length': '4',
      etag: '"abc"',
      'last-modified': 'Thu, 22 Oct 2026 03:05:56 GMT',
      'cache-control': 'public, max-age=31536000',
      'set-cookie': '__cf_bm=xyz; HttpOnly; Secure; Path=/; Domain=supabase.co',
      'cf-cache-status': 'HIT',
      'sb-project-ref': 'abcd',
      'x-robots-tag': 'none',
      ...extra,
    },
  })
}

function fetchReturning(res: Response | Error) {
  return vi.fn<typeof fetch>(async () => {
    if (res instanceof Error) throw res
    return res
  })
}

/** Vercel's CDN stores nothing that fails one of these (docs: cacheable response criteria). */
function expectCdnCacheable(res: Response) {
  expect(res.headers.has('set-cookie')).toBe(false)
  expect(res.headers.get('cache-control') ?? '').not.toMatch(/private|no-cache|no-store/)
  expect(res.headers.get('vary') ?? '').not.toMatch(/\*|cookie/i)
  expect(res.headers.get('cdn-cache-control')).toMatch(/max-age=\d+/)
}

// 2026-10-22: the vercel.json external rewrite (PR #213) never hit the CDN cache.
// Every Storage response sets Cloudflare's __cf_bm cookie and Vercel never caches
// a response with Set-Cookie, so x-vercel-cache was MISS on every request and
// every image still cost Supabase egress.
describe('proxyMedia', () => {
  it('serves the object with a year-long CDN + browser lifetime and no cookie', async () => {
    const fetchImpl = fetchReturning(storageResponse('RIFF'))
    const res = await proxyMedia('sab-brainrots', ['slushi-huski.webp'], { supabaseUrl: SB, fetch: fetchImpl })

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('RIFF')
    expectCdnCacheable(res)
    expect(res.headers.get('cache-control')).toBe(MEDIA_CACHE_CONTROL)
    expect(MEDIA_CACHE_CONTROL).toBe('public, max-age=31536000, immutable')
    expect(res.headers.get('cdn-cache-control')).toMatch(/max-age=31536000/)
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(res.headers.get('content-length')).toBe('4')
    expect(res.headers.get('etag')).toBe('"abc"')
  })

  it('passes on only what an image needs (no Storage/Cloudflare headers)', async () => {
    const res = await proxyMedia('sab-brainrots', ['a.webp'], { supabaseUrl: SB, fetch: fetchReturning(storageResponse('RIFF')) })
    for (const h of ['set-cookie', 'cf-cache-status', 'sb-project-ref', 'x-robots-tag']) {
      expect(res.headers.has(h)).toBe(false)
    }
  })

  it('serves the file inert when opened directly (our origin, not supabase.co)', async () => {
    const res = await proxyMedia('category-icons', ['g.svg'], {
      supabaseUrl: SB,
      fetch: fetchReturning(storageResponse('<svg/>', 200, { 'content-type': 'image/svg+xml' })),
    })
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-security-policy')).toMatch(/sandbox/)
    expect(res.headers.get('content-security-policy')).toMatch(/default-src 'none'/)
  })

  it('fetches the public object URL, uncached by Next, path segments encoded', async () => {
    const fetchImpl = fetchReturning(storageResponse('RIFF'))
    await proxyMedia('listing-images', ['seller 1', 'photo (2).webp'], { supabaseUrl: `${SB}/`, fetch: fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${OBJECT}/listing-images/seller%201/photo%20(2).webp`)
    expect(init?.cache).toBe('no-store')
    expect(init?.method ?? 'GET').toBe('GET')
  })

  it.each([
    ['a bucket outside the media set', 'avatars', ['u.png']],
    ['an unknown bucket', 'nope', ['x.webp']],
    ['no file path', 'sab-brainrots', []],
    ['a parent-directory segment', 'sab-brainrots', ['..', 'avatars', 'u.png']],
    ['a current-directory segment', 'sab-brainrots', ['.', 'x.webp']],
    ['an encoded slash inside a segment', 'sab-brainrots', ['../avatars/u.png']],
    ['a backslash', 'sab-brainrots', ['..\\x.webp']],
    ['an empty segment', 'sab-brainrots', ['', 'x.webp']],
  ])('404s %s without calling Storage', async (_label, bucket, path) => {
    const fetchImpl = fetchReturning(storageResponse('RIFF'))
    const res = await proxyMedia(bucket, path, { supabaseUrl: SB, fetch: fetchImpl })
    expect(res.status).toBe(404)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(res.headers.has('set-cookie')).toBe(false)
  })

  it("maps Storage's not-found (HTTP 400, NoSuchKey) to a briefly cached 404", async () => {
    const body = JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found' })
    const res = await proxyMedia('sab-brainrots', ['gone.webp'], {
      supabaseUrl: SB,
      fetch: fetchReturning(storageResponse(body, 400, { 'content-type': 'application/json' })),
    })
    expect(res.status).toBe(404)
    expectCdnCacheable(res)
    const cdnTtl = Number(/max-age=(\d+)/.exec(res.headers.get('cdn-cache-control') ?? '')?.[1])
    expect(cdnTtl).toBeGreaterThan(0)
    expect(cdnTtl).toBeLessThanOrEqual(600)
  })

  it.each([500, 502, 402, 403, 429])('answers 502, never cached, when Storage says %i', async (status) => {
    const res = await proxyMedia('sab-brainrots', ['a.webp'], {
      supabaseUrl: SB,
      fetch: fetchReturning(storageResponse('err', status)),
    })
    expect(res.status).toBe(502)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('cdn-cache-control')).toBe('no-store')
    expect(res.headers.has('set-cookie')).toBe(false)
  })

  it('answers 502, never cached, when Storage is unreachable (never throws)', async () => {
    const res = await proxyMedia('sab-brainrots', ['a.webp'], { supabaseUrl: SB, fetch: fetchReturning(new TypeError('fetch failed')) })
    expect(res.status).toBe(502)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('answers 500, never cached, when the project URL is not configured', async () => {
    const fetchImpl = fetchReturning(storageResponse('RIFF'))
    const res = await proxyMedia('sab-brainrots', ['a.webp'], { supabaseUrl: '', fetch: fetchImpl })
    expect(res.status).toBe(500)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
