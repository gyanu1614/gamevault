import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MEDIA_BUCKETS, MEDIA_PREFIX, mediaUrl } from './media-url'

const SB = 'https://abcd.supabase.co'
const pub = (bucket: string, path: string) => `${SB}/storage/v1/object/public/${bucket}/${path}`

// 2026-10-20 usage audit (A1): every image came straight from Supabase Storage
// at full size, so every visitor's download counted against the 5 GB egress.
// Art and listing photos are served through our own origin (/media/*), which
// Vercel's CDN caches: Supabase serves each file about once per region.
describe('mediaUrl', () => {
  it('maps a public art/listing bucket URL to our /media path', () => {
    expect(mediaUrl(pub('sab-brainrots', 'a/b.webp'), SB)).toBe('/media/sab-brainrots/a/b.webp')
    expect(mediaUrl(pub('listing-images', 'x.webp'), SB)).toBe('/media/listing-images/x.webp')
  })

  it('keeps the query string (cache busters)', () => {
    expect(mediaUrl(`${pub('category-icons', 'g.webp')}?v=2`, SB)).toBe('/media/category-icons/g.webp?v=2')
  })

  it('tolerates a trailing slash on the project URL', () => {
    expect(mediaUrl(pub('game-heroes', 'h.avif'), `${SB}/`)).toBe('/media/game-heroes/h.avif')
  })

  it('leaves buckets whose files change in place (avatars, store banners) on Supabase', () => {
    expect(mediaUrl(pub('avatars', 'u.png'), SB)).toBe(pub('avatars', 'u.png'))
    expect(mediaUrl(pub('store-banners', 's.webp'), SB)).toBe(pub('store-banners', 's.webp'))
  })

  it('leaves anything else alone', () => {
    for (const u of ['https://static.wikia.nocookie.net/x.png', '/games/sab.webp', 'data:image/png;base64,AAAA', `${SB}/storage/v1/object/sign/listing-images/x?token=t`]) {
      expect(mediaUrl(u, SB)).toBe(u)
    }
    expect(mediaUrl(null, SB)).toBeNull()
    expect(mediaUrl(undefined, SB)).toBeNull()
    expect(mediaUrl(pub('listing-images', 'x.webp'), undefined)).toBe(pub('listing-images', 'x.webp'))
  })
})

// 2026-10-22: the vercel.json external rewrite never hit the CDN cache (Storage
// sets a Cloudflare cookie on every response; Vercel won't cache Set-Cookie).
// /media is now a route handler that drops the cookie (lib/images/media-proxy).
describe('the /media route', () => {
  const ROUTE = 'src/app/media/[bucket]/[...path]/route.ts'

  it('is our route handler, not a vercel.json rewrite to Storage', () => {
    const vercel = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
      rewrites?: { source: string; destination: string }[]
      headers?: { source: string }[]
    }
    expect(vercel.rewrites?.some((r) => r.source.startsWith(MEDIA_PREFIX)) ?? false).toBe(false)
    expect(vercel.headers?.some((h) => h.source.startsWith(MEDIA_PREFIX)) ?? false).toBe(false)
    expect(readFileSync(join(process.cwd(), 'next.config.js'), 'utf8')).not.toMatch(/source:\s*'\/media/)
  })

  it('renders per request, so the CDN is the only cache (literal segment config)', () => {
    const src = readFileSync(join(process.cwd(), ROUTE), 'utf8')
    expect(src).toMatch(/export const dynamic = 'force-dynamic'/)
  })

  it('serves a media bucket object without the Storage cookie', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', SB)
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response('RIFF', { headers: { 'content-type': 'image/webp', 'set-cookie': '__cf_bm=x' } }),
    )
    vi.stubGlobal('fetch', fetchImpl)
    try {
      const { GET } = await import('@/app/media/[bucket]/[...path]/route')
      const res = await GET(new Request('http://localhost/media/sab-brainrots/a/b.webp'), {
        params: { bucket: MEDIA_BUCKETS[0], path: ['a', 'b.webp'] },
      })
      expect(res.status).toBe(200)
      expect(res.headers.has('set-cookie')).toBe(false)
      expect(fetchImpl.mock.calls[0][0]).toBe(pub(MEDIA_BUCKETS[0], 'a/b.webp'))
    } finally {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    }
  })

  it('middleware never runs for /media', () => {
    const mw = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8')
    expect(mw).toMatch(/\(\?!_next\/static\|_next\/image\|media\//)
  })
})
