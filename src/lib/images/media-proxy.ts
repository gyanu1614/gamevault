/**
 * GET /media/<bucket>/<path>: one public Storage object, answered so Vercel's
 * CDN keeps it (src/app/media/[bucket]/[...path]/route.ts).
 *
 * Why not a vercel.json external rewrite (PR #213): every Storage response
 * carries Cloudflare's `__cf_bm` bot cookie, and Vercel's CDN never stores a
 * response with Set-Cookie. The rewrite was `x-vercel-cache: MISS` on every
 * request (2026-10-22), so every image still cost Supabase egress. Here the
 * object is fetched and re-sent with only the headers an image needs: no
 * cookie, a year in the browser and on the CDN.
 *
 * Supabase then serves each file about once per region per deployment (Vercel
 * scopes cached responses to the deployment that made them). A miss is one
 * short function call that streams the bytes through; nothing is stored by
 * Next (no ISR, no Data Cache).
 */
import { MEDIA_BUCKETS } from './media-url'

/** Media buckets hold files that never change in place (see media-url.ts). */
export const MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const MEDIA_CDN_CACHE_CONTROL = 'public, max-age=31536000'

// A missing file may be uploaded soon after its row (catalogue runs), so a 404
// is only held briefly — long enough to absorb a page's repeated requests.
const NOT_FOUND_CACHE_CONTROL = 'public, max-age=60'
const NOT_FOUND_CDN_CACHE_CONTROL = 'public, max-age=300'

const UPSTREAM_TIMEOUT_MS = 10_000

// Everything else Storage sends (Set-Cookie, cf-*, sb-*, x-robots-tag) is dropped.
const PASSED_HEADERS = ['content-type', 'content-length', 'etag', 'last-modified'] as const

// Our origin now serves these files, so one opened directly (an SVG icon) must
// not run script as dropmarket.gg. Same policy as next.config.js `images`.
const INERT_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
}

const BUCKETS = new Set<string>(MEDIA_BUCKETS)

function isSafeSegment(s: string): boolean {
  return s !== '' && s !== '.' && s !== '..' && !/[/\\\0]/.test(s)
}

function plain(status: number, cacheControl: string, cdnCacheControl = cacheControl): Response {
  return new Response(status === 404 ? 'Not Found' : 'Image unavailable', {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': cacheControl,
      'CDN-Cache-Control': cdnCacheControl,
      ...INERT_HEADERS,
    },
  })
}

const notFound = () => plain(404, NOT_FOUND_CACHE_CONTROL, NOT_FOUND_CDN_CACHE_CONTROL)

export async function proxyMedia(
  bucket: string,
  path: string[],
  opts: { supabaseUrl?: string; fetch?: typeof fetch } = {},
): Promise<Response> {
  if (!BUCKETS.has(bucket) || path.length === 0 || !path.every(isSafeSegment)) return notFound()

  const supabaseUrl = (opts.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  if (!supabaseUrl) return plain(500, 'no-store')

  const objectUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path.map(encodeURIComponent).join('/')}`
  let upstream: Response
  try {
    upstream = await (opts.fetch ?? fetch)(objectUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return plain(502, 'no-store')
  }

  // Storage answers a missing object with 400 + {"statusCode":"404"}.
  if (upstream.status === 400 || upstream.status === 404) return notFound()
  if (upstream.status !== 200 || !upstream.body) return plain(502, 'no-store')

  const headers = new Headers({
    'Cache-Control': MEDIA_CACHE_CONTROL,
    'CDN-Cache-Control': MEDIA_CDN_CACHE_CONTROL,
    ...INERT_HEADERS,
  })
  for (const name of PASSED_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  return new Response(upstream.body, { status: 200, headers })
}
