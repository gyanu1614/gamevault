'use client'

/**
 * Editor image upload. A server action takes at most 4 MB, so a bigger phone
 * photo is shrunk in the browser first (longest side 3200px, JPEG 92) — the
 * server then makes the real AVIF/WebP set. A crop (cover) is scaled with it.
 */
import { uploadBlogImageV2 } from '@/lib/actions/admin-blog-images'
import type { StoredImage } from '@/lib/blog/doc/types'

const LIMIT = 3_800_000
const MAX_SIDE = 3200

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

async function shrink(file: File): Promise<{ file: File; scale: number }> {
  if (file.size <= LIMIT || file.type === 'image/gif') return { file, scale: 1 }
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('shrink failed'))), 'image/jpeg', 0.92))
  return { file: new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }), scale }
}

export async function uploadImage(
  input: File,
  kind: 'body' | 'cover' = 'body',
  crop?: CropRect | null,
): Promise<{ ok: true; image: StoredImage } | { ok: false; error: string }> {
  try {
    const { file, scale } = await shrink(input)
    const form = new FormData()
    form.set('file', file)
    form.set('kind', kind)
    if (crop) form.set('crop', JSON.stringify({ x: crop.x * scale, y: crop.y * scale, width: crop.width * scale, height: crop.height * scale }))
    const res = await uploadBlogImageV2(form)
    return res.success ? { ok: true, image: res.image } : { ok: false, error: res.error }
  } catch {
    return { ok: false, error: 'The upload failed. Check the file and try again.' }
  }
}
