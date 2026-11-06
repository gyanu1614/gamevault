import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

import { PICTURE_BUCKETS, PICTURE_WIDTHS, pictureSizeForShown, pictureUrl, storedPicturePath, storedPictureUrl } from './picture-url'

const DB = 'https://abc.supabase.co'
const stored = (bucket: string, file = 'x.webp') => `${DB}/storage/v1/object/public/${bucket}/${file}`

describe('pictureUrl', () => {
  it('asks the image optimizer for one standard size, WebP at quality 75', () => {
    const url = pictureUrl(stored('sab-brainrots'), 'card', DB)
    expect(url).toBe(`/_next/image?url=${encodeURIComponent(stored('sab-brainrots'))}&w=256&q=75`)
  })

  it('gives each size its own width', () => {
    expect(pictureUrl(stored('values-items'), 'icon', DB)).toContain('&w=64&')
    expect(pictureUrl(stored('values-items'), 'thumb', DB)).toContain('&w=128&')
    expect(pictureUrl(stored('values-items'), 'card', DB)).toContain('&w=256&')
    expect(pictureUrl(stored('values-items'), 'big', DB)).toContain('&w=640&')
    expect(pictureUrl(stored('values-items'), 'full', DB)).toContain('&w=1200&')
  })

  it('covers every public picture bucket whose files never change', () => {
    for (const bucket of ['sab-brainrots', 'values-items', 'adopt-me-pets', 'category-icons', 'game-covers', 'listing-images', 'blog-images', 'attribute-icons']) {
      expect(pictureUrl(stored(bucket), 'card', DB), bucket).toContain('/_next/image?')
    }
  })

  it('leaves a picture that is overwritten in place, or the old one would stay for a month', () => {
    expect(pictureUrl(stored('avatars', 'u/avatar.webp'), 'icon', DB)).toBe(stored('avatars', 'u/avatar.webp'))
    expect(pictureUrl(stored('store-banners', 'u/banner.webp'), 'full', DB)).toBe(stored('store-banners', 'u/banner.webp'))
  })

  it('never sends a private file through a public cache', () => {
    expect(pictureUrl(stored('kyc-documents', 'u/id.jpg'), 'card', DB)).toBe(stored('kyc-documents', 'u/id.jpg'))
    expect(pictureUrl(stored('delivery-evidence', 'o/p.jpg'), 'card', DB)).toBe(stored('delivery-evidence', 'o/p.jpg'))
    const signed = `${DB}/storage/v1/object/sign/delivery-evidence/o/p.jpg?token=abc`
    expect(pictureUrl(signed, 'card', DB)).toBe(signed)
  })

  it('leaves anything that is not one of our stored pictures', () => {
    for (const url of ['/games/art/adopt-me.webp', 'data:image/png;base64,AAAA', 'blob:https://x/1', 'https://other.example/a.png']) {
      expect(pictureUrl(url, 'card', DB)).toBe(url)
    }
  })

  it('serves an already-sized file as it is through the original size', () => {
    expect(pictureUrl(stored('game-heroes', 'a-1600.avif'), 'original', DB)).toBe('/media/game-heroes/a-1600.avif')
    expect(pictureUrl(stored('blog-images', 'a.avif'), 'original', DB)).toBe('/media/blog-images/a.avif')
    expect(pictureUrl(stored('avatars', 'a.webp'), 'original', DB)).toBe(stored('avatars', 'a.webp'))
  })

  it('hands back nothing for nothing, so <img src> stays valid', () => {
    expect(pictureUrl(null, 'card', DB)).toBeUndefined()
    expect(pictureUrl(undefined, 'card', DB)).toBeUndefined()
    expect(pictureUrl('', 'card', DB)).toBeUndefined()
  })

  it('leaves the url alone when the project url is unknown', () => {
    expect(pictureUrl(stored('values-items'), 'card', '')).toBe(stored('values-items'))
  })
})

describe('pictureSizeForShown', () => {
  it('picks the smallest size at twice the shown width, the rule Eldorado, GameBoost and eBay all use', () => {
    expect(pictureSizeForShown(22)).toBe('icon')
    expect(pictureSizeForShown(32)).toBe('icon')
    expect(pictureSizeForShown(36)).toBe('thumb')
    expect(pictureSizeForShown(64)).toBe('thumb')
    expect(pictureSizeForShown(88)).toBe('card')
    expect(pictureSizeForShown(128)).toBe('card')
    expect(pictureSizeForShown(220)).toBe('big')
    expect(pictureSizeForShown(320)).toBe('big')
    expect(pictureSizeForShown(600)).toBe('full')
    expect(pictureSizeForShown(2000)).toBe('full')
  })
})

describe('next.config.js', () => {
  const config = readFileSync('next.config.js', 'utf8')

  it('turned the optimizer back on, with one format and one quality', () => {
    expect(config).not.toMatch(/^\s*unoptimized:\s*true/m)
    expect(config).toMatch(/formats:\s*\['image\/webp'\]/)
    expect(config).toMatch(/qualities:\s*\[75\]/)
    expect(config).toMatch(/minimumCacheTTL:\s*2678400/)
  })

  it('allows every standard width, or the optimizer answers 400', () => {
    const list = (name: string) =>
      (config.match(new RegExp(`${name}:\\s*\\[([^\\]]*)\\]`))?.[1] ?? '').split(',').map((n) => Number(n.trim()))
    const allowed = new Set([...list('imageSizes'), ...list('deviceSizes')])
    for (const width of Object.values(PICTURE_WIDTHS)) expect(allowed.has(width), String(width)).toBe(true)
  })

  it('lets only our public picture buckets through, not every Supabase project', () => {
    expect(config).not.toContain("hostname: '**.supabase.co'")
    const buckets = config.match(/const PICTURE_BUCKETS = \[([^\]]*)\]/)?.[1] ?? ''
    expect(buckets.match(/'[^']+'/g)?.map((b) => b.replace(/'/g, ''))).toEqual([...PICTURE_BUCKETS])
    expect(PICTURE_BUCKETS).not.toContain('kyc-documents')
    expect(PICTURE_BUCKETS).not.toContain('delivery-evidence')
    expect(PICTURE_BUCKETS).not.toContain('avatars')
  })
})

describe('storedPicturePath and storedPictureUrl', () => {
  it('a stored picture travels as its short path and comes back whole', () => {
    const path = storedPicturePath(stored('values-items', 'a/b.webp'), DB)
    expect(path).toBe('values-items/a/b.webp')
    expect(storedPictureUrl(path, DB)).toBe(stored('values-items', 'a/b.webp'))
  })

  it('anything else travels unchanged', () => {
    for (const url of ['/games/x.png', 'https://other.example/a.png', 'data:image/png;base64,AA']) {
      expect(storedPicturePath(url, DB)).toBe(url)
      expect(storedPictureUrl(url, DB)).toBe(url)
    }
  })
})
