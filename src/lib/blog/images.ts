/**
 * Blog images, processed ONCE at upload (2026-10-12 revamp), never per view:
 *
 *   source (JPG / PNG / WebP / AVIF, ≤ 6 MB)
 *     → EXIF rotation applied, metadata stripped, optional crop (covers 16:9)
 *     → widths 480 / 960 / 1440 / 1920 (never upscaled; a narrower source
 *       keeps its own width as the top size)
 *     → each width as AVIF (quality stepped down to a byte budget — the
 *       smallest common format) and WebP q78 (the fallback)
 *     → a 24 px WebP blur placeholder (data URL, a few hundred bytes)
 *     → content-hashed immutable paths blog/{hash}/{w}.{avif|webp}
 *
 * Served straight from storage with a year-long cache; the page picks a size
 * with srcset/sizes and the browser picks AVIF or WebP via <picture>.
 * GIFs are stored as uploaded (keeps animation).
 */
import 'server-only'

import { createHash } from 'node:crypto'
import sharp, { type OutputInfo, type Sharp } from 'sharp'

export const BLOG_WIDTHS = [480, 960, 1440, 1920] as const
const AVIF_QUALITIES = [58, 50, 42, 34, 28] as const
const WEBP_QUALITY = 78
const BLUR_WIDTH = 24
const MAX_INPUT_PIXELS = 60_000_000
/** AVIF byte budget for a width: ~53 KB at 480, ~211 KB at 1920. */
const avifBudget = (w: number) => Math.round(w * 110)

export interface Crop {
  x: number
  y: number
  width: number
  height: number
}

export interface BlogImageFile {
  format: 'avif' | 'webp' | 'gif'
  width: number
  height: number
  bytes: Uint8Array
  path: string
}

export type ProcessedBlogImage =
  | { ok: true; hash: string; width: number; height: number; blur: string | null; files: BlogImageFile[] }
  | { ok: false; error: string }

/** Widths to encode for a source this wide. */
export function planWidths(sourceWidth: number): number[] {
  const kept = BLOG_WIDTHS.filter((w) => w <= sourceWidth)
  if (kept.length === 0) return [sourceWidth]
  const top = kept[kept.length - 1]
  if (sourceWidth > top && sourceWidth < BLOG_WIDTHS[BLOG_WIDTHS.length - 1]) return [...kept, sourceWidth]
  return [...kept]
}

export function blogImagePath(hash: string, width: number, format: BlogImageFile['format']): string {
  return `blog/${hash}/${width}.${format}`
}

function contentHash(bytes: Uint8Array, crop?: Crop | null): string {
  const h = createHash('sha256').update(bytes)
  if (crop) h.update(`crop:${crop.x},${crop.y},${crop.width},${crop.height}`)
  return h.digest('hex').slice(0, 12)
}

async function encodeAvif(img: Sharp, width: number): Promise<Buffer> {
  let out = await img.clone().resize({ width }).avif({ quality: AVIF_QUALITIES[0], effort: 4 }).toBuffer()
  for (const quality of AVIF_QUALITIES.slice(1)) {
    if (out.length <= avifBudget(width)) break
    out = await img.clone().resize({ width }).avif({ quality, effort: 4 }).toBuffer()
  }
  return out
}

export async function processBlogImage(
  bytes: Uint8Array,
  mime: string,
  opts: { crop?: Crop | null; minWidth?: number } = {},
): Promise<ProcessedBlogImage> {
  let raw: { data: Buffer; info: OutputInfo }
  try {
    let pipe = sharp(bytes, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS, animated: mime === 'image/gif' }).rotate()
    if (opts.crop) pipe = pipe.extract({ left: Math.round(opts.crop.x), top: Math.round(opts.crop.y), width: Math.round(opts.crop.width), height: Math.round(opts.crop.height) })
    if (mime === 'image/gif') {
      const meta = await sharp(bytes, { animated: true }).metadata()
      const hash = contentHash(bytes)
      const width = meta.width ?? 0
      const height = meta.pageHeight ?? meta.height ?? 0
      return { ok: true, hash, width, height, blur: null, files: [{ format: 'gif', width, height, bytes, path: blogImagePath(hash, width, 'gif') }] }
    }
    raw = await pipe.raw().toBuffer({ resolveWithObject: true })
  } catch {
    return { ok: false, error: 'That file is not a readable image.' }
  }
  const { width, height, channels } = raw.info
  if (opts.minWidth && width < opts.minWidth) {
    return { ok: false, error: `This image is ${width}px wide. Use one at least ${opts.minWidth}px wide.` }
  }
  const base = sharp(raw.data, { raw: { width, height, channels } })
  const hash = contentHash(bytes, opts.crop)
  const files: BlogImageFile[] = []
  for (const w of planWidths(width)) {
    const h = Math.round((height * w) / width)
    const avif = await encodeAvif(base, w)
    const webp = await base.clone().resize({ width: w }).webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer()
    files.push({ format: 'avif', width: w, height: h, bytes: new Uint8Array(avif), path: blogImagePath(hash, w, 'avif') })
    files.push({ format: 'webp', width: w, height: h, bytes: new Uint8Array(webp), path: blogImagePath(hash, w, 'webp') })
  }
  const blurBuf = await base.clone().resize({ width: BLUR_WIDTH }).webp({ quality: 40 }).toBuffer()
  return { ok: true, hash, width, height, blur: `data:image/webp;base64,${blurBuf.toString('base64')}`, files }
}
