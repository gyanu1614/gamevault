/**
 * Serve stored art and listing photos through our own origin, cached by
 * Vercel's CDN, instead of straight from Supabase Storage.
 *
 * Every <img> pointed at `<project>.supabase.co/storage/v1/object/public/...`,
 * so every visitor's download (cached or not) counted against Supabase's 5 GB
 * egress (2026-10-20 usage audit, A1). `/media/<bucket>/<path>` is an external
 * rewrite in vercel.json with rewrite caching on: the CDN keeps each file and
 * Supabase serves it about once per region; the transfer is Vercel's (Pro
 * includes 1 TB). `next dev` gets the same rewrite from next.config.js.
 *
 * Only buckets whose files never change in place are routed: content-hashed
 * art, listing photos and icons. Avatars and store banners are overwritten at
 * a fixed path, so they stay on Supabase (a CDN copy would show the old one).
 *
 * Pure and edge-safe.
 */

export const MEDIA_PREFIX = '/media'

/** Public buckets served through /media (vercel.json lists the same set). */
export const MEDIA_BUCKETS = [
  'sab-brainrots',
  'values-items',
  'adopt-me-pets',
  'category-icons',
  'game-heroes',
  'game-covers',
  'listing-images',
  'blog-images',
  'attribute-icons',
] as const

const BUCKETS = new Set<string>(MEDIA_BUCKETS)

/** `url` on /media when it is a public object in a media bucket; else unchanged. */
export function mediaUrl(url: string, supabaseUrl?: string): string
export function mediaUrl(url: string | null | undefined, supabaseUrl?: string): string | null
export function mediaUrl(
  url: string | null | undefined,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (!url) return null
  if (!supabaseUrl) return url
  const prefix = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/`
  if (!url.startsWith(prefix)) return url
  const rest = url.slice(prefix.length)
  const bucket = rest.slice(0, rest.indexOf('/'))
  return BUCKETS.has(bucket) ? `${MEDIA_PREFIX}/${rest}` : url
}
