'use client'

import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WhyCardProps {
  /** Ghost watermark glyph in the card corner. */
  icon: LucideIcon
  /** 3D art (same set as the buy-panel trust icons). */
  img?: string
  title: string
  body: string
  /** Glow tint behind the floating icon. */
  tone?: 'lime' | 'success' | 'info' | 'warning'
  /** Stagger position for the scroll reveal. */
  index?: number
}

const TONE = {
  lime: { glyph: 'text-lime-text', glow: 'rgba(198,255,61,0.28)' },
  success: { glyph: 'text-success', glow: 'rgba(74,222,128,0.30)' },
  info: { glyph: 'text-info', glow: 'rgba(96,165,250,0.32)' },
  warning: { glyph: 'text-warning', glow: 'rgba(251,191,36,0.28)' },
} as const

/**
 * V57 — "Why Choose" trust card, homepage edition.
 *
 * Glass surface + top sheen, rim-glow icon chip, a giant ghosted copy
 * of the icon anchoring the corner, and a CSS scroll-reveal (fade +
 * rise, staggered by index). Reveal is class-toggled CSS transition —
 * deliberately not framer-motion, which can stall mid-animation under
 * heavy trees and strand content half-visible.
 */
export function WhyCard({ icon: Icon, img, title, body, tone = 'lime', index = 0 }: WhyCardProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)
  // The stagger delay must be live ONLY for the reveal transition —
  // left in place it would also postpone every hover in/out by up to
  // 270ms on the later cards. `settled` clears it once the reveal
  // (delay + 500ms duration) has finished.
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect() // reveal once, stay revealed
        }
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const t = window.setTimeout(() => setSettled(true), index * 90 + 550)
    return () => window.clearTimeout(t)
  }, [inView, index])

  const t = TONE[tone]

  return (
    <div
      ref={ref}
      style={settled ? undefined : { transitionDelay: `${index * 90}ms` }}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border-default',
        'bg-[rgba(20,20,27,0.56)] p-6 backdrop-blur-md',
        'transition-all duration-500 ease-out',
        inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        'hover:-translate-y-1 hover:border-border-strong hover:bg-[rgba(26,26,35,0.70)]',
        'hover:shadow-[0_18px_36px_-14px_rgba(0,0,0,0.7)]',
      )}
    >
      {/* Top sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent)]"
      />
      {/* Ghost icon — giant, corner-anchored, barely there until hover. */}
      <Icon
        aria-hidden
        className="pointer-events-none absolute -bottom-7 -right-6 h-36 w-36 rotate-12 text-white opacity-[0.04] transition-all duration-500 group-hover:rotate-6 group-hover:opacity-[0.07]"
      />

      <div className="relative flex items-center gap-5">
        {/* Floating 3D trust icon — no chip box; buy-panel treatment:
            drop shadow for lift + a soft tone-tinted glow, lucide
            fallback when no render is provided. */}
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            aria-hidden
            style={{ ['--icon-glow' as string]: t.glow } as React.CSSProperties}
            className="h-[56px] w-[56px] flex-none object-contain [filter:drop-shadow(0_8px_10px_rgba(0,0,0,0.55))_drop-shadow(0_0_16px_var(--icon-glow))] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-105"
          />
        ) : (
          <Icon aria-hidden className={cn('h-8 w-8 flex-none', t.glyph)} />
        )}

        <div className="min-w-0">
          <h3 className="font-display text-[18px] font-bold leading-snug">{title}</h3>
          <p className="mt-2 text-[14.5px] leading-relaxed text-text-secondary">{body}</p>
        </div>
      </div>
    </div>
  )
}
