'use client'

/**
 * Store logo: pick a file → crop to a square (ImageCropDialog, the same
 * cropper the admin uses) → downscale to 512 px WebP in the browser → hand
 * back a data URL. The server re-checks type and size (uploadProfileAvatar).
 */
import { useRef, useState } from 'react'
import { Image as ImageIcon } from '@phosphor-icons/react/dist/ssr/Image'
import { ImageCropDialog, type PixelRect } from '@/app/(admin)/admin/components/ImageCropDialog'
import { cn } from '@/lib/utils'

const ACCEPT = 'image/png,image/jpeg,image/webp'
const MAX_INPUT_BYTES = 12 * 1024 * 1024
const OUT_SIZE = 512

async function cropToDataUrl(file: File, rect: PixelRect): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = OUT_SIZE
    canvas.height = OUT_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, OUT_SIZE, OUT_SIZE)
    const webp = canvas.toDataURL('image/webp', 0.86)
    // Browsers that cannot encode WebP return a PNG data URL — accepted too.
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
  } finally {
    bitmap.close()
  }
}

export function LogoPicker({
  value,
  initialUrl,
  storeName,
  onChange,
  disabled,
}: {
  /** The cropped data URL chosen in this session, if any. */
  value: string | null
  /** An already-saved logo (avatar) to show when nothing new was picked. */
  initialUrl: string | null
  storeName: string
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shown = value ?? initialUrl
  const initial = (storeName.trim()[0] || 'S').toUpperCase()

  const pick = (f: File | null) => {
    setError(null)
    if (!f) return
    if (!ACCEPT.split(',').includes(f.type)) return setError('Use a PNG, JPG or WebP image.')
    if (f.size > MAX_INPUT_BYTES) return setError('That file is over 12 MB. Pick a smaller one.')
    setFile(f)
  }

  const confirm = async (rect: PixelRect) => {
    if (!file) return
    setBusy(true)
    try {
      onChange(await cropToDataUrl(file, rect))
      setFile(null)
    } catch {
      setError('Could not read that image. Try another.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          'relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-white/[0.12] bg-bg-overlay',
          'flex items-center justify-center text-[26px] font-semibold text-text-secondary',
        )}
        aria-hidden
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" width={80} height={80} className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border-default bg-bg-overlay px-3 text-body-sm font-medium text-text-primary transition-colors hover:border-border-strong hover:bg-bg-overlay-2 disabled:opacity-50"
          >
            <ImageIcon weight="duotone" className="h-4 w-4" aria-hidden />
            {shown ? 'Change Logo' : 'Upload Logo'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="h-9 px-2 text-body-sm text-text-tertiary hover:text-text-primary">
              Remove
            </button>
          )}
        </div>
        <p className="mt-1.5 text-caption font-normal text-text-tertiary">Square works best. PNG, JPG or WebP, up to 12 MB.</p>
        {error && <p role="alert" className="mt-1 text-caption font-normal text-error">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <ImageCropDialog
        file={file}
        aspect={1}
        title="Crop Your Logo"
        hint="Drag the corners. This is how your store appears next to every listing."
        minWidth={128}
        busy={busy}
        onCancel={() => setFile(null)}
        onConfirm={confirm}
      />
    </div>
  )
}
