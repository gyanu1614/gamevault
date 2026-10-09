'use client'

/**
 * Signature pad on signature_pad v5 (the maintained core — the old
 * react-signature-canvas wrapper pins a 2017 build). A light "paper" surface
 * with dark ink inside the dark card, sized to the device pixel ratio so
 * strokes are crisp on phones. Exposes the PNG via onChange (null when empty).
 */
import { useEffect, useRef, useState } from 'react'
import SignaturePadLib from 'signature_pad'
import { Eraser } from '@phosphor-icons/react/dist/ssr/Eraser'
import { cn } from '@/lib/utils'

export function SignaturePad({
  onChange,
  disabled,
  className,
}: {
  onChange: (pngDataUrl: string | null) => void
  disabled?: boolean
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pad = new SignaturePadLib(canvas, {
      penColor: '#111318',
      backgroundColor: '#FFFFFF',
      minWidth: 0.9,
      maxWidth: 2.6,
      throttle: 8,
    })
    padRef.current = pad

    const resize = () => {
      // Resizing clears the canvas: keep the strokes and replay them.
      const data = pad.toData()
      const ratio = Math.max(1, window.devicePixelRatio || 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d')?.scale(ratio, ratio)
      pad.clear()
      if (data.length) pad.fromData(data)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const emit = () => {
      const isEmpty = pad.isEmpty()
      setEmpty(isEmpty)
      onChange(isEmpty ? null : pad.toDataURL('image/png'))
    }
    pad.addEventListener('endStroke', emit)
    return () => {
      ro.disconnect()
      pad.removeEventListener('endStroke', emit)
      pad.off()
      padRef.current = null
    }
    // onChange is stable enough per mount; re-creating the pad would wipe strokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const pad = padRef.current
    if (!pad) return
    if (disabled) pad.off()
    else pad.on()
  }, [disabled])

  const clear = () => {
    padRef.current?.clear()
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className={cn('relative', className)}>
      <canvas
        ref={canvasRef}
        aria-label="Signature pad. Draw your signature with your finger or mouse."
        role="img"
        className={cn(
          'block h-40 w-full touch-none rounded-md border border-white/[0.14] bg-white shadow-[inset_0_1px_3px_rgba(0,0,0,0.12)] sm:h-44',
          disabled && 'opacity-60',
        )}
      />
      {empty && (
        <p aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-body-sm text-black/35">
          Sign here
        </p>
      )}
      <span aria-hidden className="pointer-events-none absolute bottom-9 left-5 right-5 border-t border-dashed border-black/15" />
      <button
        type="button"
        onClick={clear}
        disabled={empty || disabled}
        className="absolute bottom-2 right-2 inline-flex h-8 items-center gap-1.5 rounded-md bg-black/[0.06] px-2.5 text-caption font-normal font-medium text-black/70 transition-colors hover:bg-black/[0.1] disabled:opacity-0"
      >
        <Eraser weight="bold" className="h-3.5 w-3.5" aria-hidden />
        Clear
      </button>
    </div>
  )
}
