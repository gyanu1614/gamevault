'use client'

/**
 * Drag-to-reposition for the store banner (Settings → Seller → Shop Banner).
 *
 * The frame has the exact shape of the public header strip at its widest
 * (STORE_BANNER_FRAME_ASPECT), and the image inside is drawn the way the
 * server stores it (centre-cropped to 15 : 4, full width). The seller drags
 * it up or down — 1:1 with the pointer, rubber-banded at the ends, momentum
 * on release — to choose which slice shows; the value is the vertical focal
 * point 0–100 that the shop renders as `object-position: 50% y%`.
 *
 * Keyboard: the frame is a vertical slider. ↑ / ↓ move 5 %, Home / End jump
 * to the top / bottom edge. Reduced motion: keyboard moves are instant.
 */

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import { ArrowsDownUpIcon } from '@phosphor-icons/react/dist/csr/ArrowsDownUp'
import { BannerMelt } from '@/components/shop/StoreBannerArt'
import {
  STORE_BANNER_ASPECT,
  STORE_BANNER_FOCAL_STEP,
  STORE_BANNER_FRAME_ASPECT,
  bannerTravel,
  clampBannerFocalY,
  focalToOffset,
  offsetToFocal,
} from '@/lib/shop/store-banner'
import { cn } from '@/lib/utils'

// Measure before paint in the browser; plain effect on the server (no warning).
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function BannerPositionEditor({
  src,
  value,
  onChange,
  disabled = false,
  children,
}: {
  /** The image to position (saved banner URL or an unsaved data URL). */
  src: string
  /** Focal point 0–100. */
  value: number
  onChange: (focalY: number) => void
  disabled?: boolean
  /** Overlays (status chips). */
  children?: ReactNode
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [travel, setTravel] = useState(0)
  const [dragging, setDragging] = useState(false)
  const busyRef = useRef(false) // a drag or its momentum is in flight
  const y = useMotionValue(0)
  const reduceMotion = useReducedMotion()
  const focal = clampBannerFocalY(value)

  // Measure the frame: travel = how far the 15:4 image overhangs it.
  useIsoLayoutEffect(() => {
    const el = frameRef.current
    if (!el) return
    const measure = () => setTravel(bannerTravel(el.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // On resize: place the image for the current value, no animation.
  useIsoLayoutEffect(() => {
    if (!busyRef.current) y.set(focalToOffset(focal, travel))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- value changes animate below
  }, [travel, y])

  // On a value change from outside a drag (keys, Cancel, a new upload):
  // glide there from wherever the image is now (critically damped).
  useEffect(() => {
    if (busyRef.current) return
    const target = focalToOffset(focal, travel)
    if (reduceMotion) {
      y.set(target)
      return
    }
    const controls = animate(y, target, { type: 'spring', bounce: 0, duration: 0.35 })
    return () => controls.stop()
  }, [focal, travel, reduceMotion, y])

  const commit = () => {
    busyRef.current = false
    setDragging(false)
    onChange(offsetToFocal(y.get(), travel))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    let next: number | null = null
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = focal + STORE_BANNER_FOCAL_STEP
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = focal - STORE_BANNER_FOCAL_STEP
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = 100
    if (next == null) return
    e.preventDefault()
    onChange(clampBannerFocalY(next))
  }

  const canDrag = !disabled && travel > 0

  return (
    <div
      ref={frameRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Banner Position"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={focal}
      aria-valuetext={focal === 50 ? 'Centred' : `${focal}% from the top`}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      className={cn(
        'relative w-full select-none overflow-hidden rounded-md bg-[#1A1B1F]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        // A vertical drag owns vertical touch; horizontal pans still scroll.
        canDrag && ['touch-pan-x', dragging ? 'cursor-grabbing' : 'cursor-grab'],
      )}
      style={{ aspectRatio: String(STORE_BANNER_FRAME_ASPECT) }}
    >
      <motion.div
        className="absolute inset-x-0 top-0 will-change-transform"
        style={{ y, aspectRatio: String(STORE_BANNER_ASPECT) }}
        drag={canDrag ? 'y' : false}
        dragConstraints={{ top: -travel, bottom: 0 }}
        dragElastic={0.12}
        dragMomentum
        dragTransition={{ power: 0.2, timeConstant: 220, bounceStiffness: 420, bounceDamping: 42 }}
        onDragStart={() => {
          busyRef.current = true
          setDragging(true)
        }}
        onDragTransitionEnd={commit}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview / unoptimized bucket image */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full object-cover object-center"
        />
      </motion.div>

      {/* The same soft lower edge the shop draws, so the preview is honest. */}
      <BannerMelt src={null} />

      {canDrag && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-[12px] font-semibold text-white backdrop-blur-sm transition-opacity duration-200',
            '[@media(prefers-reduced-transparency:reduce)]:bg-black/85 [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none',
            dragging ? 'opacity-0' : 'opacity-100',
          )}
        >
          <ArrowsDownUpIcon size={13} weight="bold" aria-hidden />
          Drag To Reposition
        </span>
      )}

      {children}
    </div>
  )
}
