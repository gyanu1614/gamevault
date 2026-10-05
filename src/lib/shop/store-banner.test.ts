import { describe, it, expect } from 'vitest'
import {
  canUploadStoreBanner,
  defaultBannerArt,
  isStoreBannerUrl,
  parseBannerDataUrl,
  resolveStoreBanner,
  STORE_BANNER_MAX_BYTES,
} from './store-banner'

const SB = 'https://abc.supabase.co'
const OK_URL = `${SB}/storage/v1/object/public/store-banners/u1/banner?t=1`

describe('store banner — tier gate', () => {
  it('rejects Bronze, unknown and missing ranks', () => {
    expect(canUploadStoreBanner('bronze')).toBe(false)
    expect(canUploadStoreBanner(null)).toBe(false)
    expect(canUploadStoreBanner(undefined)).toBe(false)
    expect(canUploadStoreBanner('platinum')).toBe(false)
    expect(canUploadStoreBanner('constructor')).toBe(false)
  })

  it('allows Silver, Gold, Diamond and Legendary', () => {
    for (const t of ['silver', 'gold', 'diamond', 'legendary']) expect(canUploadStoreBanner(t)).toBe(true)
  })
})

describe('store banner — render rule', () => {
  it('shows a stored banner for a Silver+ seller', () => {
    expect(resolveStoreBanner({ bannerUrl: OK_URL, tier: 'silver' }, SB)).toEqual({ kind: 'custom', url: OK_URL })
    expect(resolveStoreBanner({ bannerUrl: OK_URL, tier: 'gold' }, SB)).toEqual({ kind: 'custom', url: OK_URL })
  })

  it('hides the stored banner once the seller drops below Silver (file is kept)', () => {
    expect(resolveStoreBanner({ bannerUrl: OK_URL, tier: 'bronze' }, SB)).toEqual({ kind: 'default' })
  })

  it('never renders a URL outside our store-banners bucket', () => {
    const bad = [
      'https://evil.example/x.png',
      `${SB}/storage/v1/object/public/avatars/u1/a.png`,
      `${SB}/storage/v1/object/public/store-banners/u1/x.png') ; background:url('https://evil`,
      `${SB}/storage/v1/object/public/store-banners/u1/a b.png`,
      '',
      null,
    ]
    for (const url of bad) expect(resolveStoreBanner({ bannerUrl: url, tier: 'legendary' }, SB)).toEqual({ kind: 'default' })
    expect(isStoreBannerUrl(OK_URL, `${SB}/`)).toBe(true)
    expect(isStoreBannerUrl(OK_URL, undefined)).toBe(false)
  })
})

describe('store banner — default art', () => {
  it('is deterministic per seller and differs between sellers', () => {
    expect(defaultBannerArt('seller-a')).toEqual(defaultBannerArt('seller-a'))
    const many = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((s) => defaultBannerArt(`seller-${s}`).background))
    expect(many.size).toBeGreaterThan(1)
  })

  it('uses no accent green and no external image', () => {
    const { background } = defaultBannerArt('x')
    expect(background).not.toMatch(/url\(/)
    expect(background.toLowerCase()).not.toMatch(/lime|#56b87f|#c6f/)
    expect(background).toContain('#212228')
  })
})

describe('store banner — upload payload', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
  const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0])
  const url = (mime: string, b: Buffer) => `data:${mime};base64,${b.toString('base64')}`

  it('accepts JPG, PNG and WebP whose bytes match the declared type', () => {
    expect(parseBannerDataUrl(url('image/png', png))).toMatchObject({ ok: true, mime: 'image/png' })
    expect(parseBannerDataUrl(url('image/jpeg', jpg))).toMatchObject({ ok: true, mime: 'image/jpeg' })
    expect(parseBannerDataUrl(url('image/webp', webp))).toMatchObject({ ok: true, mime: 'image/webp' })
  })

  it('rejects other types, mislabelled bytes, junk and oversize files', () => {
    expect(parseBannerDataUrl(url('image/gif', Buffer.from('GIF89a')))).toMatchObject({ ok: false })
    expect(parseBannerDataUrl(url('image/svg+xml', Buffer.from('<svg/>')))).toMatchObject({ ok: false })
    expect(parseBannerDataUrl(url('image/png', jpg))).toMatchObject({ ok: false })
    expect(parseBannerDataUrl(url('image/png', Buffer.from('hello')))).toMatchObject({ ok: false })
    expect(parseBannerDataUrl(42)).toMatchObject({ ok: false })
    const big = Buffer.alloc(STORE_BANNER_MAX_BYTES + 10)
    png.copy(big)
    expect(parseBannerDataUrl(url('image/png', big))).toEqual({ ok: false, error: 'Banner must be 2.5 MB or smaller.' })
  })
})
