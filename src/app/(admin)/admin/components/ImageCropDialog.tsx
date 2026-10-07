'use client'

/**
 * Pick the part of an image to use: the image in a dialog with a fixed-shape
 * rectangle on top (react-image-crop). Drag the box to move it, drag its
 * corners to resize; the shape stays the band's aspect. Save hands back the
 * rectangle in the image's own pixels (as the browser shows it, EXIF
 * orientation applied — the server applies the same orientation before it
 * cuts, so the two agree).
 *
 * Owner, 2026-10-06: replaces drag-to-position for the game hero and the CTA
 * banner ("upload → see the image in a modal with a rectangle → choose the
 * part → save").
 */

import { useEffect, useRef, useState } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop, type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { adminBtn } from './kit'

export interface PixelRect {
  x: number
  y: number
  width: number
  height: number
}

/** The widest box of this aspect that fits, centred. */
function initialCrop(width: number, height: number, aspect: number): PercentCrop {
  return centerCrop(makeAspectCrop({ unit: '%', width: 100 }, aspect, width, height), width, height)
}

/** Percent crop → natural pixels, rounded and kept inside the image. */
export function toPixelRect(crop: PercentCrop, naturalWidth: number, naturalHeight: number): PixelRect {
  const x = Math.max(0, Math.round((crop.x / 100) * naturalWidth))
  const y = Math.max(0, Math.round((crop.y / 100) * naturalHeight))
  return {
    x,
    y,
    width: Math.min(Math.round((crop.width / 100) * naturalWidth), naturalWidth - x),
    height: Math.min(Math.round((crop.height / 100) * naturalHeight), naturalHeight - y),
  }
}

export function ImageCropDialog({
  file,
  aspect,
  title,
  hint,
  minWidth = 0,
  busy = false,
  onCancel,
  onConfirm,
}: {
  /** The picked file; null closes the dialog. */
  file: File | null
  /** Width / height of the box. */
  aspect: number
  title: string
  /** One line under the title (what the area is used for). */
  hint?: string
  /** Narrowest acceptable area, in image pixels (warns below it). */
  minWidth?: number
  busy?: boolean
  onCancel: () => void
  onConfirm: (rect: PixelRect) => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<PercentCrop | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    setCrop(null)
    setNatural(null)
    if (!file) {
      setSrc(null)
      return
    }
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const rect = crop && natural ? toPixelRect(crop, natural.w, natural.h) : null
  const tooSmall = !!rect && minWidth > 0 && rect.width < minWidth

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="max-w-4xl gap-0 border-0 bg-[#1D1E23] p-0 sm:max-w-4xl">
        <div className="px-5 pb-4 pt-5 sm:px-6">
          <DialogTitle className="text-[17px] font-semibold text-text-primary">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-text-tertiary">
            {hint ?? 'Drag the box to choose the part to use. Drag a corner to resize it.'}
          </DialogDescription>
        </div>

        <div className="grid min-h-[240px] place-items-center bg-black/40 px-3 py-3 sm:px-5">
          {src && (
            <ReactCrop
              crop={crop ?? undefined}
              onChange={(_px, pct) => setCrop(pct)}
              aspect={aspect}
              keepSelection
              ruleOfThirds
              className="max-h-[62dvh]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img
                ref={imgRef}
                src={src}
                alt="Image to crop"
                className="max-h-[62dvh] w-auto max-w-full"
                onLoad={(e) => {
                  const img = e.currentTarget
                  setNatural({ w: img.naturalWidth, h: img.naturalHeight })
                  setCrop(initialCrop(img.width, img.height, aspect))
                }}
              />
            </ReactCrop>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <p className={cn('text-[12.5px] tabular-nums', tooSmall ? 'text-[#F5C451]' : 'text-text-tertiary')}>
            {rect
              ? tooSmall
                ? `${rect.width} × ${rect.height} px chosen. Choose a wider area (at least ${minWidth} px).`
                : `${rect.width} × ${rect.height} px chosen`
              : 'Loading image…'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} disabled={busy} className={adminBtn.secondary}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => rect && onConfirm(rect)}
              disabled={!rect || tooSmall || busy}
              className={adminBtn.primary}
            >
              {busy && <CircleNotchIcon aria-hidden weight="bold" className="h-4 w-4 animate-spin" />}
              {busy ? 'Saving…' : 'Save Image'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
