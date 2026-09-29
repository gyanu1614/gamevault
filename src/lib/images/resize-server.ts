/**
 * Shrink an uploaded image ONCE, on our server, before it is stored:
 * longest side capped (default 1600 px), EXIF orientation applied, WebP at
 * quality 80. Images are served unoptimized (next.config), so what we store
 * is exactly what every visitor downloads; a 6 MB phone photo becomes a
 * ~150-300 KB WebP.
 *
 * GIFs are stored as uploaded (keeps animation). A file sharp can't decode
 * is refused by the caller's type check before it gets here.
 */
import 'server-only'

import sharp from 'sharp'

export interface StoredImage {
  bytes: Uint8Array
  mime: string
  ext: string
}

export async function toStoredImage(
  bytes: Uint8Array,
  mime: string,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<StoredImage> {
  if (mime === 'image/gif') return { bytes, mime, ext: 'gif' }
  const maxDim = opts.maxDim ?? 1600
  const out = await sharp(bytes, { failOn: 'error', limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: opts.quality ?? 80 })
    .toBuffer()
  return { bytes: new Uint8Array(out), mime: 'image/webp', ext: 'webp' }
}
