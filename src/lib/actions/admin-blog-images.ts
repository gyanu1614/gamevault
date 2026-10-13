'use server'

/**
 * Blog image upload for the block editor (2026-10-12): the file arrives as
 * FormData (binary, no base64 overhead), is processed once
 * (src/lib/blog/images.ts → AVIF + WebP widths, size, blur) and every variant
 * is stored under a content-hashed path, cached for a year. Returns the
 * StoredImage the editor keeps in the image block. Admin only.
 */
import { createClient as createServiceClient } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/actions/admin-permissions'
import { processBlogImage, type Crop } from '@/lib/blog/images'
import type { SrcItem, StoredImage } from '@/lib/blog/doc/types'

const BUCKET = 'blog-images'
/** Server-action body cap is 4 MB (next.config); the editor pre-shrinks larger files. */
const MAX_BYTES = 3_900_000
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']

type Result = { success: true; image: StoredImage } | { success: false; error: string }

function admin() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

function parseCrop(raw: FormDataEntryValue | null): Crop | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const c = JSON.parse(raw) as Crop
    return [c.x, c.y, c.width, c.height].every((n) => Number.isFinite(n) && n >= 0) && c.width > 0 && c.height > 0 ? c : null
  } catch {
    return null
  }
}

export async function uploadBlogImageV2(form: FormData): Promise<Result> {
  await requireAdmin()
  const file = form.get('file')
  if (!(file instanceof File)) return { success: false, error: 'No image was sent.' }
  if (!TYPES.includes(file.type)) return { success: false, error: 'Use a PNG, JPEG, WebP, AVIF or GIF image.' }
  if (file.size > MAX_BYTES) return { success: false, error: 'That image is over 4 MB. Use a smaller one.' }
  const kind = form.get('kind') === 'cover' ? 'cover' : 'body'

  const processed = await processBlogImage(new Uint8Array(await file.arrayBuffer()), file.type, {
    crop: parseCrop(form.get('crop')),
    // Google Discover wants a cover at least 1200px wide.
    minWidth: kind === 'cover' ? 1200 : undefined,
  })
  if (!processed.ok) return { success: false, error: processed.error }

  const supabase = admin()
  const url = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  for (const f of processed.files) {
    const { error } = await supabase.storage.from(BUCKET).upload(f.path, f.bytes, {
      contentType: `image/${f.format}`,
      cacheControl: '31536000',
      // Content-hashed: the same image re-uploaded is the same file.
      upsert: true,
    })
    if (error) return { success: false, error: `Upload failed: ${error.message}` }
  }
  const list = (format: 'avif' | 'webp'): SrcItem[] =>
    processed.files.filter((f) => f.format === format).map((f) => ({ w: f.width, url: url(f.path) }))
  const webp = list('webp')
  const top = processed.files[processed.files.length - 1]
  return {
    success: true,
    image: {
      src: webp.length ? webp[webp.length - 1].url : url(top.path),
      width: processed.width,
      height: processed.height,
      blur: processed.blur,
      sources: { avif: list('avif'), webp },
    },
  }
}
