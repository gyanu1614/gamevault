import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

vi.mock('server-only', () => ({}))
import { toStoredImage } from './resize-server'

async function photo(width: number, height: number, format: 'png' | 'jpeg' = 'png') {
  // Noisy pixels so the encoder can't cheat: a realistic, hard-to-compress image.
  const raw = Buffer.alloc(width * height * 3)
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 251
  const img = sharp(raw, { raw: { width, height, channels: 3 } })
  return new Uint8Array(await (format === 'png' ? img.png() : img.jpeg({ quality: 95 })).toBuffer())
}

describe('toStoredImage', () => {
  it('shrinks a big photo to <=1600 px WebP', async () => {
    // A real photo from the repo, blown up to phone-camera size as a PNG.
    const input = new Uint8Array(
      await sharp('public/hero/roblox.jpg').resize({ width: 3200 }).png().toBuffer(),
    )
    const out = await toStoredImage(input, 'image/png')
    expect(out.mime).toBe('image/webp')
    expect(out.ext).toBe('webp')
    const meta = await sharp(out.bytes).metadata()
    expect(meta.format).toBe('webp')
    expect(Math.max(meta.width!, meta.height!)).toBe(1600)
    expect(out.bytes.byteLength).toBeLessThan(input.byteLength)
  })

  it('never enlarges a small image', async () => {
    const out = await toStoredImage(await photo(400, 300, 'jpeg'), 'image/jpeg')
    const meta = await sharp(out.bytes).metadata()
    expect([meta.width, meta.height]).toEqual([400, 300])
  })

  it('keeps GIFs as uploaded (animation)', async () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    const out = await toStoredImage(gif, 'image/gif')
    expect(out).toEqual({ bytes: gif, mime: 'image/gif', ext: 'gif' })
  })

  it('refuses bytes that are not an image', async () => {
    await expect(toStoredImage(new Uint8Array([1, 2, 3, 4]), 'image/png')).rejects.toThrow()
  })
})
