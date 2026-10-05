/**
 * Game hero image processing — ONE pipeline for the admin upload and the
 * bulk import script (`pnpm game-hero:import`).
 *
 *   source (JPG / PNG / WebP / AVIF, ≤ 6 MB)
 *     → EXIF orientation applied, metadata stripped
 *     → WebP at 960 / 1600 / 2400 px wide (never upscaled; the source width is
 *       added when it falls between steps), quality 72
 *     → a 24 px wide WebP LQIP as a data: URL (a few hundred bytes)
 *     → file names content-hashed: {gameId}/{hash}-{width}.webp, so every
 *       file is immutable and can be cached for a year.
 *
 * WebP only, no AVIF: the hero is drawn at brightness 0.5 under a veil, where
 * AVIF's extra quality is invisible, an AVIF encode of a 2400 px image costs
 * seconds of server CPU, and a second format would need a second preload
 * (browsers that take AVIF would fetch both). Served straight from storage —
 * no Next image optimizer.
 *
 * Self-contained on purpose (no `@/` imports, sharp loaded dynamically): the
 * import script runs this file through Node's type-stripper, and Next code
 * imports it only from the server.
 */
import { createHash } from 'node:crypto'

export const HERO_WIDTHS = [960, 1600, 2400] as const
export const HERO_WEBP_QUALITY = 72
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

/** First 12 hex chars of the source's SHA-256: same file → same names. */
export function heroContentHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 12)
}

export function heroVariantPath(gameId: string, hash: string, width: number): string {
  return `${gameId}/${hash}-${width}.webp`
}

/** The widths to emit for a source this wide (ascending, never upscaled). */
export function heroWidthsFor(sourceWidth: number): number[] {
  const widths: number[] = HERO_WIDTHS.filter((w) => w <= sourceWidth)
  const largest = widths[widths.length - 1] ?? 0
  if (sourceWidth > largest && sourceWidth < HERO_WIDTHS[HERO_WIDTHS.length - 1]) widths.push(sourceWidth)
  return widths
}

type SharpFn = (typeof import('sharp'))['default']

async function loadSharp(): Promise<SharpFn> {
  const mod = await import('sharp')
  return (mod as unknown as { default: SharpFn }).default ?? (mod as unknown as SharpFn)
}

export async function processHeroImage(gameId: string, input: Uint8Array): Promise<ProcessedHero> {
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
  if (width < HERO_MIN_WIDTH) {
    return { ok: false, error: `Use an image at least ${HERO_MIN_WIDTH} px wide (2400 px or wider works best).` }
  }
  if (width / height < HERO_MIN_ASPECT) {
    return { ok: false, error: 'Use a landscape image (wider than it is tall, 16:9 or wider works best).' }
  }

  const hash = heroContentHash(input)
  try {
    const variants: HeroVariant[] = []
    for (const w of heroWidthsFor(width)) {
      const { data, info } = await sharp(input, opts)
        .rotate()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: HERO_WEBP_QUALITY, effort: 4 })
        .toBuffer({ resolveWithObject: true })
      variants.push({ width: info.width, height: info.height, bytes: new Uint8Array(data), path: heroVariantPath(gameId, hash, info.width) })
    }
    const lqip = await sharp(input, opts)
      .rotate()
      .resize({ width: HERO_LQIP_WIDTH })
      .webp({ quality: 40 })
      .toBuffer()
    const blur = `data:image/webp;base64,${Buffer.from(lqip).toString('base64')}`
    return { ok: true, hash, sourceWidth: width, sourceHeight: height, variants, blur }
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
