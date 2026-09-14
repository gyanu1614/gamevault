'use client'

/**
 * ArtBackdrop — the shared full-bleed artwork treatment.
 *
 * One layer stack, used by both the hero and the pre-footer CTA band so the
 * two surfaces are literally the same code at different exposures rather than
 * two hand-tuned copies that drift apart.
 *
 * Layers, back to front. All are absolute siblings so `mix-blend-mode` on the
 * grade layers composites against the art: a blend layer nested INSIDE the
 * motion wrapper blends against that wrapper's own (transparent) background
 * instead, because `will-change: transform` gives it its own stacking context.
 *
 *   1. Art — darkened by CSS filter, breathing keyframe + cursor parallax
 *   2. Grade A — colour-blend radial, tints art toward the page ground
 *   3. Grade B — flat dark
 *   4. Grade C — faint green cast
 *   5. Falloff radial — centre stays least dark, edges fall away
 *   6. Top fade    (optional)
 *   7. Bottom fade (optional)
 *   8. Text scrim  (optional) — protects copy only, never band-wide
 *
 * Callers render their own content above this; the backdrop is inert
 * (`pointer-events: none`) and `aria-hidden`.
 */

import { useEffect } from 'react'
import { useMotionValue, useSpring, motion } from 'framer-motion'
import Image from 'next/image'

interface ArtBackdropProps {
  /** Clean in-game screenshot. No baked-in text or logos. */
  src: string
  /**
   * Exposure. Lower sits the art further back. The hero runs brighter
   * (opening energy), the CTA band darker (closing note).
   */
  brightness?: number
  /** Fade the top edge to the page ground. Off when chrome sits over the art. */
  topFade?: boolean
  /** Fade the bottom edge to the page ground. */
  bottomFade?: boolean
  /**
   * Extra bleed below the container, in px. The art overhangs its section and
   * carries on behind whatever follows, so ambient light crosses the section
   * boundary instead of stopping at it.
   */
  overhang?: number
  /** Radial scrim behind the copy. */
  textScrim?: boolean
  /** Priority-load the image (true for above-the-fold art). */
  priority?: boolean
}

export function ArtBackdrop({
  src,
  brightness = 0.6,
  topFade = true,
  bottomFade = true,
  overhang = 0,
  textScrim = true,
  priority = false,
}: ArtBackdropProps) {
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const springConfig = { damping: 80, stiffness: 60, mass: 1.4 }
  const springX = useSpring(rawX, springConfig)
  const springY = useSpring(rawY, springConfig)

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    if (!mq.matches) return
    const onMove = (e: MouseEvent) => {
      rawX.set(((e.clientX / window.innerWidth) * 2 - 1) * -7)
      rawY.set(((e.clientY / window.innerHeight) * 2 - 1) * -4)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [rawX, rawY])

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0"
      style={{ bottom: overhang ? -overhang : 0 }}
    >
      {/* 1 — Art. Its own clip so the parallax bleed never shows an edge. */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          data-band-art=""
          className="absolute inset-x-0 -inset-y-[9%]"
          style={{
            willChange: 'transform',
            animation: 'dm-breathe 25s cubic-bezier(.45,0,.55,1) infinite',
            translateX: springX,
            translateY: springY,
          }}
        >
          <Image
            src={src}
            alt=""
            aria-hidden
            fill
            sizes="100vw"
            priority={priority}
            style={{
              objectFit: 'cover',
              objectPosition: 'center',
              filter: `brightness(${brightness}) saturate(.70) contrast(1.05)`,
            }}
          />
        </motion.div>
      </div>

      {/* 2 — Grade A: tints toward the page ground without draining the art. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(closest-side at 50% 54%, rgba(23,27,33,0) 0%, rgba(23,27,33,.5) 52%, rgba(23,27,33,1) 88%)',
          mixBlendMode: 'color',
          opacity: 0.3,
        }}
      />

      {/* 3 — Grade B: flat dark. */}
      <div className="absolute inset-0" style={{ background: '#171B21', opacity: 0.25 }} />

      {/* 4 — Grade C: faint green cast, ties the art to the palette. */}
      <div className="absolute inset-0" style={{ background: 'rgba(42,122,80,.09)' }} />

      {/* 5 — Falloff radial, drifting slowly. */}
      <div
        data-light-drift=""
        className="absolute -inset-[6%]"
        style={{
          background:
            'radial-gradient(closest-side at 50% 54%, rgba(23,27,33,0) 0%, rgba(23,27,33,.12) 40%, rgba(23,27,33,.62) 68%, rgba(23,27,33,.95) 88%)',
          animation: 'dm-lightdrift 40s cubic-bezier(.42,0,.58,1) infinite',
          willChange: 'transform',
        }}
      />

      {/* 6 — Top fade. */}
      {topFade && (
        <div
          className="absolute inset-x-0 top-0 h-[52%]"
          style={{
            background:
              'linear-gradient(180deg, var(--color-bg-base) 0%, var(--color-bg-base) 4%, rgba(23,27,33,.92) 22%, rgba(23,27,33,.6) 48%, rgba(23,27,33,0) 100%)',
          }}
        />
      )}

      {/* 7 — Bottom fade. */}
      {bottomFade && (
        <div
          className="absolute inset-x-0 bottom-0 h-[52%]"
          style={{
            background:
              'linear-gradient(0deg, var(--color-bg-base) 0%, var(--color-bg-base) 4%, rgba(23,27,33,.92) 22%, rgba(23,27,33,.6) 48%, rgba(23,27,33,0) 100%)',
          }}
        />
      )}

      {/* 8 — Text scrim: protects the copy only. */}
      {textScrim && (
        <div
          className="absolute left-1/2 top-1/2 h-[400px] w-[min(1000px,124%)] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              'radial-gradient(closest-side, rgba(14,17,21,.82), rgba(14,17,21,.44) 46%, rgba(14,17,21,0) 78%)',
          }}
        />
      )}
    </div>
  )
}
