import { mediaUrl } from './media-url'

/**
 * The one way a stored picture becomes a URL on a page.
 *
 * WebP at quality 75, in a few standard widths: the first viewer of a size makes
 * Vercel's image optimizer resize it, and everyone after gets the saved copy.
 * That cache is keyed by project, not deployment ("Redeploying your app doesn't
 * invalidate the image cache"), so a release doesn't start pictures over, and a
 * saved picture keeps loading while Supabase is down. Billed per resize (once a
 * picture per size per 31 days), so the bill follows new pictures, not visitors.
 *
 * Moving pictures elsewhere later (Cloudflare R2) means changing this file.
 *
 * Pure and edge-safe.
 */

/** Width of each standard size. Keep next.config.js imageSizes/deviceSizes in step. */
export const PICTURE_WIDTHS = {
  icon: 64,
  thumb: 128,
  card: 256,
  big: 640,
  full: 1200,
} as const

export type PictureSize = keyof typeof PICTURE_WIDTHS

export const PICTURE_QUALITY = 75

/**
 * Public buckets whose files never change at a path. Keep next.config.js in step.
 * Avatars and store banners are overwritten in place, so the optimizer would show
 * the old one for a month; private buckets must never reach a public cache.
 */
export const PICTURE_BUCKETS = [
  'sab-brainrots',
  'values-items',
  'adopt-me-pets',
  'category-icons',
  'game-covers',
  'listing-images',
  'blog-images',
  'attribute-icons',
] as const

const BUCKETS = new Set<string>(PICTURE_BUCKETS)

/**
 * `size` is how the picture is shown. 'original' serves a file that is already
 * stored in its own sizes (game heroes, blog bodies) exactly as it is.
 * Anything that isn't one of our stored pictures comes back unchanged.
 */
export function pictureUrl(url: string, size: PictureSize | 'original', supabaseUrl?: string): string
export function pictureUrl(url: string | null | undefined, size: PictureSize | 'original', supabaseUrl?: string): string | undefined
export function pictureUrl(
  url: string | null | undefined,
  size: PictureSize | 'original',
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | undefined {
  if (!url) return undefined
  if (!supabaseUrl) return url
  if (size === 'original') return mediaUrl(url, supabaseUrl)
  const prefix = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/`
  if (!url.startsWith(prefix)) return url
  const rest = url.slice(prefix.length)
  if (!BUCKETS.has(rest.slice(0, rest.indexOf('/')))) return url
  return `/_next/image?url=${encodeURIComponent(url)}&w=${PICTURE_WIDTHS[size]}&q=${PICTURE_QUALITY}`
}

const storagePrefix = (supabaseUrl: string) => `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/`

/** A stored picture's short path, for a long list sent to the browser. Anything else stays as it is. */
export function storedPicturePath(url: string, supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string {
  if (!supabaseUrl) return url
  const prefix = storagePrefix(supabaseUrl)
  return url.startsWith(prefix) ? url.slice(prefix.length) : url
}

/** Back from storedPicturePath. A short path has no leading slash and no scheme. */
export function storedPictureUrl(path: string, supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string {
  if (!supabaseUrl || path.startsWith('/') || /^[a-z]+:/i.test(path)) return path
  return `${storagePrefix(supabaseUrl)}${path}`
}

/** The smallest standard size that stays sharp on a 2x screen at this shown width. */
export function pictureSizeForShown(cssPx: number): PictureSize {
  const sizes = Object.keys(PICTURE_WIDTHS) as PictureSize[]
  return sizes.find((size) => PICTURE_WIDTHS[size] >= cssPx * 2) ?? 'full'
}
