/**
 * Game hero image processing — ONE pipeline for the admin upload and the
 * bulk import script (`pnpm game-hero:import`).
 *
 *   source (JPG / PNG / WebP / AVIF, ≤ 6 MB)
 *     → EXIF orientation applied, metadata stripped
 *     → cut to the admin's crop rectangle (the band shape), when given
 *     → AVIF at 960 / 1600 / 1920 px wide (never upscaled), each kept under
 *       HERO_MAX_BYTES by stepping the quality down (encodeAvifUnder)
 *     → a 24 px wide WebP LQIP as a data: URL (a few hundred bytes)
 *     → file names content-hashed: {gameId}/{hash}-{width}.avif, so every
 *       file is immutable and can be cached for a year.
 *
 * Owner, 2026-10-06: pages must load the hero with no delay, so every file is
 * ≤ ~100 KB. The old WebP q72 set was 90 / 226 / 356 KB (Roblox). The hero is
 * drawn darkened under a veil, so AVIF at a low quality is indistinguishable
 * on the page; 2400 px was dropped for the same reason. AVIF's slower encode
 * only costs the one admin upload. Served straight from storage — no Next
 * image optimizer.
 *
 * Self-contained on purpose (no `@/` imports, sharp loaded dynamically): the
 * import script runs this file through Node's type-stripper, and Next code
 * imports it only from the server.
 */
import { createHash } from 'node:crypto'

type SharpFn = (typeof import('sharp'))['default']

export const HERO_WIDTHS = [960, 1600, 1920] as const
/** Byte budget per file (owner: "under 100 KB"). */
export const HERO_MAX_BYTES = 100_000
/** AVIF qualities tried in order until a file fits the budget. */
export const AVIF_QUALITY_STEPS = [52, 44, 36, 30, 24, 18] as const
export const HERO_LQIP_WIDTH = 24
/** Narrower than this and the hero is visibly soft on a laptop. */
export const HERO_MIN_WIDTH = 1280
/** Wider-than-tall only: the band is a landscape strip. */
export const HERO_MIN_ASPECT = 1.2
const MAX_INPUT_PIXELS = 60_000_000

export interface HeroVariant {
  width: number
  height: number
  bytes: Uint8Array
  /** Object path inside the bucket. */
  path: string
}

export type ProcessedHero =
  | {
      ok: true
      hash: string
      sourceWidth: number
      sourceHeight: number
      variants: HeroVariant[]
      /** data:image/webp;base64,… */
      blur: string
    }
  | { ok: false; error: string }

/** First 12 hex chars of the SHA-256 of the source (+ the crop): same file and area → same names. */
export function heroContentHash(bytes: Uint8Array, crop?: HeroCrop | null): string {
  const h = createHash('sha256').update(bytes)
  if (crop) h.update(`crop:${crop.x},${crop.y},${crop.width},${crop.height}`)
  return h.digest('hex').slice(0, 12)
}

export function heroVariantPath(gameId: string, hash: string, width: number): string {
  return `${gameId}/${hash}-${width}.avif`
}

/** A crop rectangle in source pixels, as displayed (EXIF orientation applied). */
export interface HeroCrop {
  x: number
  y: number
  width: number
  height: number
}

/** Integer rectangle inside a w × h image, or null when it falls outside. */
export function clampCrop(crop: HeroCrop, w: number, h: number): HeroCrop | null {
  const vals = [crop.x, crop.y, crop.width, crop.height]
  if (!vals.every((v) => Number.isFinite(v))) return null
  const x = Math.max(0, Math.round(crop.x))
  const y = Math.max(0, Math.round(crop.y))
  const width = Math.min(Math.round(crop.width), w - x)
  const height = Math.min(Math.round(crop.height), h - y)
  if (width < 1 || height < 1) return null
  return { x, y, width, height }
}

type SharpImage = ReturnType<SharpFn>

/**
 * AVIF under a byte budget: the first quality step whose file fits, or the
 * last step's file (a busy photo at 1920 px may still be a little over).
 * `make` must return a fresh pipeline each call (sharp pipelines are single-use).
 */
export async function encodeAvifUnder(
  make: () => SharpImage,
  maxBytes: number = HERO_MAX_BYTES,
): Promise<{ data: Buffer; info: { width: number; height: number; size: number }; quality: number }> {
  let last: { data: Buffer; info: { width: number; height: number; size: number }; quality: number } | null = null
  for (const quality of AVIF_QUALITY_STEPS) {
    const { data, info } = await make().avif({ quality, effort: 4, chromaSubsampling: '4:2:0' }).toBuffer({ resolveWithObject: true })
    last = { data, info, quality }
    if (data.byteLength <= maxBytes) break
  }
  return last!
}

/** The widths to emit for a source this wide (ascending, never upscaled). */
export function heroWidthsFor(sourceWidth: number): number[] {
  const widths: number[] = HERO_WIDTHS.filter((w) => w <= sourceWidth)
  const largest = widths[widths.length - 1] ?? 0
  if (sourceWidth > largest && sourceWidth < HERO_WIDTHS[HERO_WIDTHS.length - 1]) widths.push(sourceWidth)
  return widths
}

async function loadSharp(): Promise<SharpFn> {
  const mod = await import('sharp')
  return (mod as unknown as { default: SharpFn }).default ?? (mod as unknown as SharpFn)
}

export async function processHeroImage(gameId: string, input: Uint8Array, crop?: HeroCrop | null): Promise<ProcessedHero> {
  const sharp = await loadSharp()
  const opts = { failOn: 'error' as const, limitInputPixels: MAX_INPUT_PIXELS }

  let width = 0
  let height = 0
  try {
    const meta = await sharp(input, opts).metadata()
    // As displayed: orientations 5–8 swap the sides.
    const swap = (meta.orientation ?? 1) >= 5
    width = (swap ? meta.height : meta.width) ?? 0
    height = (swap ? meta.width : meta.height) ?? 0
  } catch {
    return { ok: false, error: 'That file is not a valid JPG, PNG, WebP or AVIF image.' }
  }
  if (!width || !height) return { ok: false, error: 'That file is not a valid JPG, PNG, WebP or AVIF image.' }
  // The region that becomes the hero: the admin's crop, or the whole image.
  let region: HeroCrop | null = null
  if (crop) {
    region = clampCrop(crop, width, height)
    if (!region) return { ok: false, error: 'The crop is outside the image. Choose the area again.' }
  }
  const outW = region ? region.width : width
  const outH = region ? region.height : height
  if (outW < HERO_MIN_WIDTH) {
    return {
      ok: false,
      error: region
        ? `The chosen area is ${outW} px wide. Choose a wider area (at least ${HERO_MIN_WIDTH} px) or use a bigger image.`
        : `Use an image at least ${HERO_MIN_WIDTH} px wide (1920 px or wider works best).`,
    }
  }
  if (outW / outH < HERO_MIN_ASPECT) {
    return { ok: false, error: 'Use a landscape image (wider than it is tall, 16:9 or wider works best).' }
  }

  const hash = heroContentHash(input, region)
  const base = () => {
    const img = sharp(input, opts).rotate()
    return region ? img.extract({ left: region.x, top: region.y, width: region.width, height: region.height }) : img
  }
  try {
    const variants: HeroVariant[] = []
    for (const w of heroWidthsFor(outW)) {
      const { data, info } = await encodeAvifUnder(() => base().resize({ width: w, withoutEnlargement: true }))
      variants.push({ width: info.width, height: info.height, bytes: new Uint8Array(data), path: heroVariantPath(gameId, hash, info.width) })
    }
    const lqip = await base()
      .resize({ width: HERO_LQIP_WIDTH })
      .webp({ quality: 40 })
      .toBuffer()
    const blur = `data:image/webp;base64,${Buffer.from(lqip).toString('base64')}`
    return { ok: true, hash, sourceWidth: outW, sourceHeight: outH, variants, blur }
  } catch {
    return { ok: false, error: 'That image could not be processed. Try another one.' }
  }
}

/** The DB patch for a processed hero, given each variant's public URL. */
export function heroColumnsFor(
  processed: { variants: HeroVariant[]; blur: string },
  publicUrl: (path: string) => string,
  focalY: number,
  nowIso: string,
): {
  hero_bg_url: string
  hero_bg_srcset: Record<string, string>
  hero_bg_blur: string
  hero_bg_focal_y: number
  hero_bg_updated_at: string
} {
  const srcset: Record<string, string> = {}
  for (const v of processed.variants) srcset[String(v.width)] = publicUrl(v.path)
  const under = processed.variants.filter((v) => v.width <= 1600)
  const def = under.length > 0 ? under[under.length - 1] : processed.variants[0]
  return {
    hero_bg_url: publicUrl(def.path),
    hero_bg_srcset: srcset,
    hero_bg_blur: processed.blur,
    hero_bg_focal_y: focalY,
    hero_bg_updated_at: nowIso,
  }
}
