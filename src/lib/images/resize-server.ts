/**
 * Shrink an uploaded image ONCE, on our server, before it is stored: longest
 * side capped at the standard for its kind, EXIF orientation applied, WebP.
 * What's stored then can't grow with what people upload (a 6 MB phone photo
 * becomes a ~150-300 KB WebP); the sizes a page shows come from pictureUrl.
 *
 * GIFs (animation) and SVGs (no pixels) are stored as uploaded. A file sharp
 * can't decode is refused by the caller's type check before it gets here.
 */
import 'server-only'

import sharp from 'sharp'

/** The largest each kind of picture is ever stored. */
export const IMAGE_STANDARDS = {
  /** A seller's photo: the largest shown is 820 px wide on a 2x screen. */
  listing: { maxDim: 1600, quality: 80 },
  /** A game's cover art. */
  cover: { maxDim: 1200, quality: 80 },
  /** A face or store logo, shown small. */
  avatar: { maxDim: 512, quality: 80 },
  /** Admin-uploaded game, category and option icons: flat art, so a little more quality. */
  icon: { maxDim: 512, quality: 85 },
} as const

export type ImageKind = keyof typeof IMAGE_STANDARDS

export interface StoredImage {
  bytes: Uint8Array
  mime: string
  ext: string
}

export async function toStoredImage(bytes: Uint8Array, mime: string, kind: ImageKind): Promise<StoredImage> {
  if (mime === 'image/gif') return { bytes, mime, ext: 'gif' }
  if (mime === 'image/svg+xml') return { bytes, mime, ext: 'svg' }
  const { maxDim, quality } = IMAGE_STANDARDS[kind]
  const out = await sharp(bytes, { failOn: 'error', limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer()
  return { bytes: new Uint8Array(out), mime: 'image/webp', ext: 'webp' }
}
