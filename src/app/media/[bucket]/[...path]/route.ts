/**
 * /media/<bucket>/<path>: stored art and listing photos (lib/images/media-url),
 * fetched from Supabase Storage and answered without its cookie so Vercel's
 * CDN caches them (lib/images/media-proxy). Middleware never runs here.
 */
import { proxyMedia } from '@/lib/images/media-proxy'

// Per request, never prerendered: the CDN holds the answer, so Next must not
// also store the bytes (ISR / Data Cache). Literal: Next reads it statically.
export const dynamic = 'force-dynamic'

export function GET(_req: Request, { params }: { params: { bucket: string; path: string[] } }) {
  return proxyMedia(params.bucket, params.path)
}
