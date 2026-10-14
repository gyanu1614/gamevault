import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import sharp from 'sharp'
import { BLOG_WIDTHS, blogImagePath, planWidths, processBlogImage } from './images'

describe('planWidths', () => {
  it('fixed widths up to the source, never upscaled', () => {
    expect(planWidths(4000)).toEqual([480, 960, 1440, 1920])
    expect(planWidths(1500)).toEqual([480, 960, 1440, 1500])
    expect(planWidths(960)).toEqual([480, 960])
  })
  it('a tiny source is kept at its own width', () => {
    expect(planWidths(300)).toEqual([300])
  })
  it('the widths are the documented set', () => {
    expect(BLOG_WIDTHS).toEqual([480, 960, 1440, 1920])
  })
})

describe('processBlogImage', () => {
  it('AVIF + WebP per width, real size kept, a blur, content-hashed paths', async () => {
    const png = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: { r: 30, g: 120, b: 200 } } }).png().toBuffer()
    const out = await processBlogImage(new Uint8Array(png), 'image/png')
    if (!out.ok) throw new Error(out.error)
    expect(out.width).toBe(2000)
    expect(out.height).toBe(1000)
    expect(out.files.map((f) => `${f.format}:${f.width}x${f.height}`)).toEqual([
      'avif:480x240', 'webp:480x240', 'avif:960x480', 'webp:960x480',
      'avif:1440x720', 'webp:1440x720', 'avif:1920x960', 'webp:1920x960',
    ])
    expect(out.blur).toMatch(/^data:image\/webp;base64,/)
    expect(out.files[0].path).toBe(blogImagePath(out.hash, 480, 'avif'))
    expect(out.hash).toMatch(/^[0-9a-f]{12}$/)
    for (const f of out.files) expect((await sharp(Buffer.from(f.bytes)).metadata()).format).toBe(f.format === 'avif' ? 'heif' : 'webp')
  }, 60_000)
  it('a 16:9 cover crop and a minimum width', async () => {
    const png = await sharp({ create: { width: 1000, height: 1000, channels: 3, background: '#333' } }).png().toBuffer()
    const small = await processBlogImage(new Uint8Array(png), 'image/png', { minWidth: 1200 })
    expect(small).toEqual({ ok: false, error: 'This image is 1000px wide. Use one at least 1200px wide.' })
    const crop = await processBlogImage(new Uint8Array(png), 'image/png', { crop: { x: 0, y: 219, width: 1000, height: 562 } })
    if (!crop.ok) throw new Error(crop.error)
    expect([crop.width, crop.height]).toEqual([1000, 562])
  }, 60_000)
  it('refuses a file that is not an image', async () => {
    expect(await processBlogImage(new Uint8Array([1, 2, 3]), 'image/png')).toEqual({ ok: false, error: 'That file is not a readable image.' })
  })
})

describe('processBlogImage: transparent cut-outs (Blog v2)', () => {
  it('marks a picture with see-through pixels as a cut-out, and an opaque one not', async () => {
    const cutout = await sharp({ create: { width: 800, height: 600, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 200, g: 50, b: 50, alpha: 1 } } }).png().toBuffer(), left: 300, top: 200 }])
      .png()
      .toBuffer()
    const r1 = await processBlogImage(new Uint8Array(cutout), 'image/png')
    expect(r1.ok && r1.alpha).toBe(true)
    const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 30, g: 120, b: 200 } } }).jpeg().toBuffer()
    const r2 = await processBlogImage(new Uint8Array(photo), 'image/jpeg')
    expect(r2.ok && r2.alpha).toBe(false)
    // A PNG with an alpha channel that is fully opaque is still a photo.
    const opaquePng = await sharp({ create: { width: 800, height: 600, channels: 4, background: { r: 30, g: 120, b: 200, alpha: 1 } } }).png().toBuffer()
    const r3 = await processBlogImage(new Uint8Array(opaquePng), 'image/png')
    expect(r3.ok && r3.alpha).toBe(false)
  })
})
