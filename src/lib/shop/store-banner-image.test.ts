import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'

vi.mock('server-only', () => ({}))

import { toStoreBannerImage } from './store-banner-image'

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 30, g: 30, b: 36 } } }).png().toBuffer()

describe('toStoreBannerImage', () => {
  it('crops a wide image to a 1500 × 400 WebP', async () => {
    const res = await toStoreBannerImage(new Uint8Array(await solid(2000, 900)))
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const meta = await sharp(res.bytes).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1500, 400])
  })

  it('refuses an image narrower than 800 px', async () => {
    const res = await toStoreBannerImage(new Uint8Array(await solid(600, 200)))
    expect(res).toMatchObject({ ok: false })
  })

  it('refuses bytes that are not an image', async () => {
    const res = await toStoreBannerImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]))
    expect(res).toMatchObject({ ok: false })
  })
})
