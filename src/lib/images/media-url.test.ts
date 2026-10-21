import { describe, it, expect } from 'vitest'
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

describe('the /media route', () => {
  const vercel = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
    rewrites?: { source: string; destination: string }[]
    headers?: { source: string; headers: { key: string; value: string }[] }[]
  }

  it('vercel.json proxies exactly the media buckets to Supabase Storage', () => {
    const rule = vercel.rewrites?.find((r) => r.source.startsWith(MEDIA_PREFIX))
    expect(rule).toBeDefined()
    for (const b of MEDIA_BUCKETS) expect(rule!.source).toContain(b)
    expect(rule!.destination).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/:bucket\/:path\*$/)
  })

  it('opts the rewrite into the CDN cache, with a CDN lifetime', () => {
    const h = vercel.headers?.find((x) => x.source.startsWith(MEDIA_PREFIX))
    const value = (k: string) => h?.headers.find((x) => x.key.toLowerCase() === k)?.value
    expect(value('x-vercel-enable-rewrite-caching')).toBe('1')
    expect(value('cdn-cache-control')).toMatch(/max-age=\d+/)
  })

  it('middleware never runs for /media', () => {
    const mw = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8')
    expect(mw).toMatch(/\(\?!_next\/static\|_next\/image\|media\//)
  })
})
