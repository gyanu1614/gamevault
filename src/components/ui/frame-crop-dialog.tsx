'use client'

/**
 * The ONE banner editor (owner, 2026-10-12): a fixed frame in the banner's
 * shape; the picture moves and zooms under it (react-easy-crop — drag, pinch,
 * scroll or the slider), like a cover-photo editor. Under the frame, a live
 * preview of where the image is used (the game's CTA band, the shop header),
 * redrawn from the chosen area each time the picture is let go.
 *
 * Used by the admin game banner (Games → Branding → CTA banner) and the
 * seller's Shop Banner (Settings → Seller). Save hands back the chosen area in
 * the image's own pixels, plus — with `outputWidth` — the area already cut in
 * the browser as a WebP data URL.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import MagnifyingGlassMinus from '@mui/icons-material/ZoomOutRounded'
import MagnifyingGlassPlus from '@mui/icons-material/ZoomInRounded'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

export interface PixelRect {
  x: number
  y: number
  width: number
  height: number
}

const PREVIEW_WIDTH = 960

async function cut(bitmap: ImageBitmap, rect: PixelRect, width: number): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.round((width * rect.height) / rect.width)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height)
  const webp = canvas.toDataURL('image/webp', 0.88)
  // Browsers that cannot encode WebP return PNG — accepted too.
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
}

const round = (a: Area): PixelRect => ({
  x: Math.max(0, Math.round(a.x)),
  y: Math.max(0, Math.round(a.y)),
  width: Math.round(a.width),
  height: Math.round(a.height),
})

export function FrameCropDialog({
  file,
  aspect,
  title,
  hint,
  minWidth = 0,
  outputWidth,
  busy = false,
  saveLabel = 'Save Image',
  onCancel,
  onConfirm,
  renderPreview,
}: {
  /** The picked file; null closes the dialog. */
  file: File | null
  /** Width / height of the frame. */
  aspect: number
  title: string
  /** One line under the title (what the image is for). */
  hint?: string
  /** Narrowest acceptable area, in image pixels (warns below it). */
  minWidth?: number
  /** Also cut the area in the browser at this width (WebP data URL). */
  outputWidth?: number
  busy?: boolean
  saveLabel?: string
  onCancel: () => void
  onConfirm: (result: { rect: PixelRect; dataUrl: string | null }) => void
  /** The live preview, given the chosen area as an image (null while it loads). */
  renderPreview?: (src: string | null) => ReactNode
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rect, setRect] = useState<PixelRect | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [cutting, setCutting] = useState(false)
  const bitmap = useRef<ImageBitmap | null>(null)

  useEffect(() => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRect(null)
    setPreview(null)
    if (!file) {
      setSrc(null)
      return
    }
    const url = URL.createObjectURL(file)
    setSrc(url)
    let live = true
    createImageBitmap(file, { imageOrientation: 'from-image' })
      .then((b) => {
        if (live) bitmap.current = b
        else b.close()
      })
      .catch(() => {
        bitmap.current = null
      })
    return () => {
      live = false
      URL.revokeObjectURL(url)
      bitmap.current?.close()
      bitmap.current = null
    }
  }, [file])

  // Redraw the preview when the picture is let go (not on every pixel of a drag).
  const onComplete = useCallback(
    (_: Area, px: Area) => {
      const r = round(px)
      setRect(r)
      if (!renderPreview || !bitmap.current) return
      void cut(bitmap.current, r, Math.min(PREVIEW_WIDTH, r.width)).then(setPreview).catch(() => setPreview(null))
    },
    [renderPreview],
  )

  const tooSmall = !!rect && minWidth > 0 && rect.width < minWidth

  const save = async () => {
    if (!rect) return
    if (!outputWidth) return onConfirm({ rect, dataUrl: null })
    if (!bitmap.current) return
    setCutting(true)
    try {
      onConfirm({ rect, dataUrl: await cut(bitmap.current, rect, Math.min(outputWidth, rect.width)) })
    } finally {
      setCutting(false)
    }
  }

  const working = busy || cutting

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && !working && onCancel()}>
      <DialogContent className="max-h-[92dvh] max-w-3xl gap-0 overflow-y-auto border-0 bg-[#1D1E23] p-0 sm:max-w-3xl">
        <div className="px-5 pb-4 pt-5 sm:px-6">
          <DialogTitle className="text-[17px] font-semibold text-text-primary">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-text-tertiary">
            {hint ?? 'Drag the picture to place it. Zoom with the slider.'}
          </DialogDescription>
        </div>

        {/* The fixed frame: the picture moves under it. */}
        <div className="relative h-[clamp(200px,40dvh,360px)] bg-black">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              minZoom={1}
              maxZoom={4}
              objectFit="cover"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onComplete}
              style={{ cropAreaStyle: { border: '2px solid rgba(255,255,255,0.9)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)' } }}
            />
          )}
        </div>

        <div className="flex items-center gap-3 px-5 pt-4 sm:px-6">
          <MagnifyingGlassMinus aria-hidden style={{ fontSize: 18 }} className="text-text-tertiary" />
          <Slider
            value={[zoom]}
            min={1}
            max={4}
            step={0.01}
            onValueChange={([z]) => setZoom(z)}
            aria-label="Zoom"
            className="flex-1"
          />
          <MagnifyingGlassPlus aria-hidden style={{ fontSize: 18 }} className="text-text-tertiary" />
        </div>

        {renderPreview && (
          <div className="px-5 pt-5 sm:px-6">
            <p className="mb-2 text-caption font-medium text-text-tertiary">Preview</p>
            {renderPreview(preview)}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <p className={cn('text-[12.5px] tabular-nums', tooSmall ? 'text-[#F5C451]' : 'text-text-tertiary')}>
            {rect
              ? tooSmall
                ? `${rect.width} × ${rect.height} px chosen. Zoom out or use a bigger image (at least ${minWidth} px wide).`
                : `${rect.width} × ${rect.height} px chosen`
              : 'Loading image…'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={working}
              className="inline-flex h-10 items-center rounded-[6px] bg-white/[0.06] px-4 text-body-sm font-semibold text-text-primary transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!rect || tooSmall || working}
              className="inline-flex h-10 items-center rounded-[6px] bg-white px-4 text-body-sm font-semibold text-[#16171B] transition-colors hover:bg-[#E4E6EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
            >
              {working ? 'Saving…' : saveLabel}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
