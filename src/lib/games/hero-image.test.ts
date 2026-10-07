import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import {
  HERO_MAX_BYTES,
  clampCrop,
  heroColumnsFor,
  heroContentHash,
  heroVariantPath,
  heroWidthsFor,
  processHeroImage,
} from './hero-image'

const GAME = '11111111-2222-3333-4444-555555555555'

/** A real fixture image: a left→right gradient JPEG (compressible, like art). */
async function fixture(width: number, height: number, format: 'jpeg' | 'png' = 'jpeg'): Promise<Uint8Array> {
  const raw = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      raw[i] = Math.round((x / width) * 200)
      raw[i + 1] = Math.round((y / height) * 120)
      raw[i + 2] = 90
    }
  }
  const img = sharp(raw, { raw: { width, height, channels: 3 } })
  return new Uint8Array(await (format === 'jpeg' ? img.jpeg({ quality: 85 }) : img.png()).toBuffer())
}

describe('heroWidthsFor', () => {
  it('960 / 1600 / 1920, never upscaled, the source width added between steps', () => {
    expect(heroWidthsFor(3000)).toEqual([960, 1600, 1920])
    expect(heroWidthsFor(1920)).toEqual([960, 1600, 1920])
    expect(heroWidthsFor(1800)).toEqual([960, 1600, 1800])
    expect(heroWidthsFor(1600)).toEqual([960, 1600])
    expect(heroWidthsFor(1300)).toEqual([960, 1300])
  })
})

describe('processHeroImage', () => {
  it('a 3000 × 1500 JPEG → AVIF at 960 / 1600 / 1920, each under 100 KB, content-hashed names, tiny LQIP', async () => {
    const input = await fixture(3000, 1500)
    const res = await processHeroImage(GAME, input)
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const hash = heroContentHash(input)
    expect(hash).toMatch(/^[0-9a-f]{12}$/)
    expect(res.hash).toBe(hash)
    expect([res.sourceWidth, res.sourceHeight]).toEqual([3000, 1500])
    expect(res.variants.map((v) => [v.width, v.height, v.path])).toEqual([
      [960, 480, `${GAME}/${hash}-960.avif`],
      [1600, 800, `${GAME}/${hash}-1600.avif`],
      [1920, 960, `${GAME}/${hash}-1920.avif`],
    ])
    for (const v of res.variants) {
      const meta = await sharp(v.bytes).metadata()
      expect([meta.format, meta.width]).toEqual(['heif', v.width])
      expect(meta.compression).toBe('av1')
      expect(v.bytes.byteLength).toBeLessThanOrEqual(HERO_MAX_BYTES)
      // Metadata stripped: no EXIF carried over.
      expect(meta.exif).toBeUndefined()
    }
    // Smaller widths are smaller files.
    const sizes = res.variants.map((v) => v.bytes.byteLength)
    expect(sizes[0]).toBeLessThan(sizes[1])
    expect(sizes[1]).toBeLessThan(sizes[2])

    // LQIP: a data: URL of a 24 px wide WebP, well under ~600 bytes.
    expect(res.blur).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/)
    expect(res.blur.length).toBeLessThan(800)
    const lqip = await sharp(Buffer.from(res.blur.split(',')[1], 'base64')).metadata()
    expect([lqip.format, lqip.width, lqip.height]).toEqual(['webp', 24, 12])
  })

  it('same bytes → same names (idempotent re-upload); different bytes → different names', async () => {
    const a = await fixture(1400, 800)
    const b = await fixture(1400, 801)
    expect(heroContentHash(a)).toBe(heroContentHash(new Uint8Array(a)))
    expect(heroContentHash(a)).not.toBe(heroContentHash(b))
    expect(heroVariantPath(GAME, 'abc', 960)).toBe(`${GAME}/abc-960.avif`)
    // The same file cut differently is a different hero.
    expect(heroContentHash(a, { x: 0, y: 0, width: 1400, height: 500 })).not.toBe(heroContentHash(a))
  })

  it('cuts the chosen area: a 3000 × 2000 source cropped to 2570 × 1000 → 1920 × 747 top file', async () => {
    const res = await processHeroImage(GAME, await fixture(3000, 2000), { x: 200, y: 500, width: 2570, height: 1000 })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect([res.sourceWidth, res.sourceHeight]).toEqual([2570, 1000])
    expect(res.variants.map((v) => [v.width, v.height])).toEqual([[960, 374], [1600, 623], [1920, 747]])
  })

  it('refuses a crop narrower than 1280 px and one outside the image', async () => {
    const narrow = await processHeroImage(GAME, await fixture(3000, 2000), { x: 0, y: 0, width: 1000, height: 400 })
    expect(!narrow.ok && narrow.error).toMatch(/wider area/i)
    const outside = await processHeroImage(GAME, await fixture(1400, 800), { x: 5000, y: 0, width: 1400, height: 500 })
    expect(!outside.ok && outside.error).toMatch(/outside/i)
  })

  it('clampCrop rounds and keeps the rectangle inside the image', () => {
    expect(clampCrop({ x: 10.4, y: -3, width: 5000, height: 99.6 }, 2000, 1000)).toEqual({ x: 10, y: 0, width: 1990, height: 100 })
    expect(clampCrop({ x: NaN, y: 0, width: 1, height: 1 }, 10, 10)).toBeNull()
  })

  it('a 1400 px PNG keeps its own width as the top size (no upscaling)', async () => {
    const res = await processHeroImage(GAME, await fixture(1400, 700, 'png'))
    expect(res.ok && res.variants.map((v) => v.width)).toEqual([960, 1400])
  })

  it('refuses a too-narrow image, a portrait image and non-images', async () => {
    expect(await processHeroImage(GAME, await fixture(1000, 500))).toMatchObject({ ok: false })
    const portrait = await processHeroImage(GAME, await fixture(1400, 1600))
    expect(portrait).toMatchObject({ ok: false })
    expect(!portrait.ok && portrait.error).toMatch(/landscape/i)
    expect(await processHeroImage(GAME, new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]))).toMatchObject({ ok: false })
  })

})

describe('heroColumnsFor', () => {
  it('url = the 1600 file, srcset = every width, blur + focal + timestamp', () => {
    const cols = heroColumnsFor(
      {
        variants: [
          { width: 960, height: 1, bytes: new Uint8Array(), path: 'g/h-960.webp' },
          { width: 1600, height: 1, bytes: new Uint8Array(), path: 'g/h-1600.webp' },
          { width: 2400, height: 1, bytes: new Uint8Array(), path: 'g/h-2400.webp' },
        ],
        blur: 'data:image/webp;base64,AAAA',
      },
      (p) => `https://cdn/${p}`,
      35,
      '2026-10-05T00:00:00.000Z',
    )
    expect(cols).toEqual({
      hero_bg_url: 'https://cdn/g/h-1600.webp',
      hero_bg_srcset: { '960': 'https://cdn/g/h-960.webp', '1600': 'https://cdn/g/h-1600.webp', '2400': 'https://cdn/g/h-2400.webp' },
      hero_bg_blur: 'data:image/webp;base64,AAAA',
      hero_bg_focal_y: 35,
      hero_bg_updated_at: '2026-10-05T00:00:00.000Z',
    })
  })
})
