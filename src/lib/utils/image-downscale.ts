/**
 * Client-side image downscaling for avatar uploads.
 *
 * Why: the avatar is handed to a Server Action as a base64 data URI. Server
 * Actions cap request bodies at 1 MB by default and base64 adds ~33%
 * overhead, so any photo over roughly 750 KB threw
 *
 *   "Body exceeded 1 MB limit ... serverActions#bodySizeLimit"
 *
 * …while the picker advertised "Max 5 MB". In production Next omits that
 * message, so it reached users as the generic "error occurred in the Server
 * Components render" with only a digest.
 *
 * Raising bodySizeLimit would only move the ceiling: it would still push
 * multi-megabyte base64 through a server action and store a full-resolution
 * file to render an 80px tile. Downscaling first fixes the cause — a 5 MB
 * photo becomes ~30-80 KB — and re-encoding also strips EXIF (including GPS)
 * from user photos.
 */

export interface DownscaleOptions {
  /** Longest edge of the output, in pixels. */
  maxDimension?: number
  /** Encoder quality, 0-1. Ignored by lossless formats. */
  quality?: number
}

/** Thrown when the browser cannot decode the file (e.g. iPhone HEIC). */
export class ImageDecodeError extends Error {
  constructor(message = 'That image format could not be read.') {
    super(message)
    this.name = 'ImageDecodeError'
  }
}

/** Decode a File into something canvas can draw, across browsers. */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Honours EXIF orientation, unlike a bare <img> in some browsers.
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    } catch {
      /* fall through to the <img> path */
    }
  }

  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new ImageDecodeError())
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Downscale `file` so its longest edge is at most `maxDimension`, and return
 * it as a data URI. Images already smaller are still re-encoded, so every
 * upload is a predictable size and carries no EXIF.
 *
 * Prefers WebP (alpha + far smaller than PNG) and falls back to JPEG where
 * the encoder is unavailable.
 */
export async function downscaleImageToDataUrl(
  file: File,
  { maxDimension = 512, quality = 0.85 }: DownscaleOptions = {},
): Promise<string> {
  const source = await decode(file)

  const width = 'width' in source ? source.width : 0
  const height = 'height' in source ? source.height : 0
  if (!width || !height) throw new ImageDecodeError()

  const scale = Math.min(1, maxDimension / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageDecodeError('Your browser could not process this image.')

  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source as CanvasImageSource, 0, 0, targetWidth, targetHeight)

  // Release the decoded bitmap promptly — these can be large.
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) source.close()

  // toDataURL silently falls back to PNG when a format is unsupported, so
  // check what actually came back rather than trusting the request.
  const webp = canvas.toDataURL('image/webp', quality)
  if (webp.startsWith('data:image/webp')) return webp

  return canvas.toDataURL('image/jpeg', quality)
}
