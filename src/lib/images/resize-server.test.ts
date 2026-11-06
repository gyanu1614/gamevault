import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

vi.mock('server-only', () => ({}))
import { IMAGE_STANDARDS, toStoredImage } from './resize-server'

async function photo(width: number, height: number, format: 'png' | 'jpeg' = 'png') {
  // Noisy pixels so the encoder can't cheat: a realistic, hard-to-compress image.
  const raw = Buffer.alloc(width * height * 3)
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 251
  const img = sharp(raw, { raw: { width, height, channels: 3 } })
  return new Uint8Array(await (format === 'png' ? img.png() : img.jpeg({ quality: 95 })).toBuffer())
}

describe('toStoredImage', () => {
  it('shrinks a big listing photo to <=1600 px WebP', async () => {
    // A real photo from the repo, blown up to phone-camera size as a PNG.
    const input = new Uint8Array(
      await sharp('public/hero/roblox.jpg').resize({ width: 3200 }).png().toBuffer(),
    )
    const out = await toStoredImage(input, 'image/png', 'listing')
    expect(out.mime).toBe('image/webp')
    expect(out.ext).toBe('webp')
    const meta = await sharp(out.bytes).metadata()
    expect(meta.format).toBe('webp')
    expect(Math.max(meta.width!, meta.height!)).toBe(1600)
    expect(out.bytes.byteLength).toBeLessThan(input.byteLength)
  })

  it.each([
    ['avatar', 512],
    ['icon', 512],
    ['cover', 1200],
  ] as const)('holds a %s to its standard width of %i px', async (kind, width) => {
    const input = await photo(1500, 1500)
    const meta = await sharp((await toStoredImage(input, 'image/png', kind)).bytes).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(width)
    expect(IMAGE_STANDARDS[kind].maxDim).toBe(width)
  })

  it('keeps a see-through icon see-through', async () => {
    const input = new Uint8Array(
      await sharp({ create: { width: 900, height: 900, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer(),
    )
    const meta = await sharp((await toStoredImage(input, 'image/png', 'icon')).bytes).metadata()
    expect(meta.hasAlpha).toBe(true)
  })

  it('never enlarges a small image', async () => {
    const out = await toStoredImage(await photo(400, 300, 'jpeg'), 'image/jpeg', 'listing')
    const meta = await sharp(out.bytes).metadata()
    expect([meta.width, meta.height]).toEqual([400, 300])
  })

  it('keeps GIFs as uploaded (animation)', async () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    const out = await toStoredImage(gif, 'image/gif', 'listing')
    expect(out).toEqual({ bytes: gif, mime: 'image/gif', ext: 'gif' })
  })

  it('keeps an SVG icon as uploaded (it has no pixels to shrink)', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')
    const out = await toStoredImage(svg, 'image/svg+xml', 'icon')
    expect(out).toEqual({ bytes: svg, mime: 'image/svg+xml', ext: 'svg' })
  })

  it('refuses bytes that are not an image', async () => {
    await expect(toStoredImage(new Uint8Array([1, 2, 3, 4]), 'image/png', 'listing')).rejects.toThrow()
  })
})
