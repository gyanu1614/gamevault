/**
 * Shrink a photo in the BROWSER before it is uploaded straight to storage
 * (chat attachments, delivery proof): longest side capped at 1600 px, WebP
 * (JPEG where the browser can't encode WebP, e.g. Safari). Faster uploads,
 * less storage, and pages download the small file, since images are served
 * unoptimized.
 *
 * Anything it can't improve is returned as is: non-images, GIFs (animation),
 * formats the browser can't decode (HEIC in Chrome), or a result that isn't
 * smaller than the original.
 */

const SHRINKABLE = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function compressImageForUpload(
  file: File,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<File> {
  if (!SHRINKABLE.has(file.type) || typeof createImageBitmap !== 'function') return file
  const maxDim = opts.maxDim ?? 1600
  const quality = opts.quality ?? 0.82
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
    let blob = await encode('image/webp')
    // Safari can't encode WebP and silently returns PNG: use JPEG there.
    if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg')
    if (!blob || blob.size >= file.size) return file
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const name = file.name.replace(/\.[a-z0-9]+$/i, '') + '.' + ext
    return new File([blob], name, { type: blob.type, lastModified: file.lastModified })
  } finally {
    bitmap.close()
  }
}
