/**
 * Listing images (audit ACC-08).
 *
 *   · the type comes from the file's BYTES (magic numbers), never from the
 *     client-supplied name or `file.type`; the stored extension follows it
 *   · one server-side size cap
 *   · a delete may only touch the caller's own `${userId}/` prefix
 *
 * Plain TS, no I/O: the actions call these around the storage client.
 */

export const LISTING_IMAGE_BUCKET = 'listing-images'
export const LISTING_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const LISTING_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type ListingImageMime = (typeof LISTING_IMAGE_TYPES)[number]

export interface SniffedImage {
  mime: ListingImageMime
  ext: 'jpg' | 'png' | 'webp'
}

/** Identify JPEG / PNG / WebP from the leading bytes; anything else is null. */
export function sniffImageType(bytes: Uint8Array): SniffedImage | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' }
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' }
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50   // WEBP
  ) {
    return { mime: 'image/webp', ext: 'webp' }
  }
  return null
}

/** `${userId}/<time>-<rand>.<ext>` — the owner prefix the storage policy checks. */
export function listingImagePathFor(userId: string, ext: SniffedImage['ext'], now = Date.now()): string {
  return `${userId}/${now}-${Math.random().toString(36).slice(2, 8)}.${ext}`
}

/** The object path inside the bucket for a public URL, or null when the URL is not one of ours. */
export function listingImagePathFromUrl(url: string): string | null {
  const marker = `/${LISTING_IMAGE_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const path = url.slice(idx + marker.length).split('?')[0]
  try {
    return decodeURIComponent(path)
  } catch {
    return null
  }
}

/** Owner check for a delete: the caller's own prefix, no traversal, one file. */
export function isOwnedListingImagePath(path: string, userId: string): boolean {
  if (!path || !userId) return false
  if (!path.startsWith(`${userId}/`)) return false
  const rest = path.slice(userId.length + 1)
  if (!rest || rest.includes('/') || rest.includes('\\') || rest.includes('..')) return false
  return true
}

export type ImageCheck =
  | { ok: true; image: SniffedImage; bytes: Uint8Array }
  | { ok: false; error: string }

/** Size cap + sniff for an uploaded File. */
export async function checkListingImage(file: File): Promise<ImageCheck> {
  if (file.size > LISTING_IMAGE_MAX_BYTES) return { ok: false, error: 'Each image must be under 5 MB' }
  if (file.size === 0) return { ok: false, error: 'The file is empty' }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength > LISTING_IMAGE_MAX_BYTES) return { ok: false, error: 'Each image must be under 5 MB' }
  const image = sniffImageType(bytes)
  if (!image) return { ok: false, error: 'JPG, PNG, or WebP only' }
  return { ok: true, image, bytes }
}
