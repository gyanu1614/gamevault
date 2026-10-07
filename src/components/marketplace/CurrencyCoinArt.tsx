'use client'

/**
 * The currency icon as the Buy card's background art: large, tilted, cut off
 * by the card's right edge behind the Buy button, low opacity and fading out
 * toward the copy (owner, 2026-10-06: "right side behind the buy now, tilted,
 * cutting out, like a background image"). Framer Motion springs it a few degrees
 * toward the pointer while the card is hovered (a physical tilt, not a glow);
 * still under reduced motion and on touch.
 *
 * Owner, 2026-10-06: no coloured blur or outline ("full AI"); the card stays
 * the standard surface and the icon carries the colour.
 */

import { useRef, type PointerEvent, type ReactNode } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'

const SPRING = { stiffness: 140, damping: 18, mass: 0.6 }

export function CurrencyCoinArt({ src, children, className }: { src: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const reduce = useReducedMotion()
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const x = useSpring(useTransform(px, [-0.5, 0.5], [-10, 10]), SPRING)
  const y = useSpring(useTransform(py, [-0.5, 0.5], [-8, 8]), SPRING)
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), SPRING)
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [10, -10]), SPRING)

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse' || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }
  const onLeave = () => {
    px.set(0)
    py.set(0)
  }

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={className} style={{ perspective: 900 }}>
      <motion.img
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none absolute -right-16 top-[calc(50%-120px)] h-[240px] w-[240px] select-none object-contain opacity-[0.16] [mask-image:linear-gradient(105deg,transparent_8%,#000_55%)] sm:-right-10 sm:top-[calc(50%-170px)] sm:h-[340px] sm:w-[340px] sm:opacity-[0.22]"
        style={{ x, y, rotateX, rotateY, rotate: -16 }}
      />
      {children}
    </div>
  )
}
