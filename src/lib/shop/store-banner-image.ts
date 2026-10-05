/**
 * Normalise an uploaded store banner on our server before it is stored:
 * EXIF orientation applied, centre-cropped to 1500 × 400, re-encoded as WebP
 * (metadata stripped). A file sharp cannot decode, or one too narrow to look
 * sharp on a desktop shop, is refused.
 */
import 'server-only'

import sharp from 'sharp'

import { STORE_BANNER_HEIGHT, STORE_BANNER_MIN_WIDTH, STORE_BANNER_WIDTH } from './store-banner'

export type StoreBannerImage =
  | { ok: true; bytes: Uint8Array; mime: 'image/webp' }
  | { ok: false; error: string }

export async function toStoreBannerImage(input: Uint8Array): Promise<StoreBannerImage> {
  let width: number | undefined
  try {
    const meta = await sharp(input, { failOn: 'error', limitInputPixels: 60_000_000 }).metadata()
    // Width as displayed (orientations 5–8 swap the sides).
    width = (meta.orientation ?? 1) >= 5 ? meta.height : meta.width
  } catch {
    return { ok: false, error: 'That file is not a valid JPG, PNG or WebP image.' }
  }
  if (!width || width < STORE_BANNER_MIN_WIDTH) {
    return { ok: false, error: `Use an image at least ${STORE_BANNER_MIN_WIDTH} px wide (${STORE_BANNER_WIDTH} × ${STORE_BANNER_HEIGHT} works best).` }
  }
  try {
    const out = await sharp(input, { failOn: 'error', limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: STORE_BANNER_WIDTH, height: STORE_BANNER_HEIGHT, fit: 'cover', position: 'centre' })
      .webp({ quality: 82 })
      .toBuffer()
    return { ok: true, bytes: new Uint8Array(out), mime: 'image/webp' }
  } catch {
    return { ok: false, error: 'That image could not be processed. Try another one.' }
  }
}
