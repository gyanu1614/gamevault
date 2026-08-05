'use client'

/**
 * SpotlightCard — a card whose border + surface pick up a soft spotlight that
 * follows the cursor while hovering. Adapted for DropMarket's forest theme:
 * the glow is a fixed accent hue (green by default, amber option) rather than
 * the original hue-cycling version, and the pointer is tracked LOCALLY to the
 * card (not the whole window) so it works inside grids.
 *
 * Drop-in: <SpotlightCard glow="green">…</SpotlightCard>. The card keeps its
 * own border/bg via className; the spotlight layers ride on top.
 */

import { useRef, type ReactNode, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'

type Glow = 'green' | 'amber'

// hsl hue + saturation/lightness per accent (matches the forest green / founding amber).
const GLOW: Record<Glow, { hue: number; sat: number; light: number }> = {
  green: { hue: 140, sat: 45, light: 60 },
  amber: { hue: 42, sat: 90, light: 65 },
}

export function SpotlightCard({
  children,
  className,
  glow = 'green',
  /** Spotlight diameter in px. */
  size = 260,
}: {
  children: ReactNode
  className?: string
  glow?: Glow
  size?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { hue, sat, light } = GLOW[glow]

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // Pointer position relative to the card.
    el.style.setProperty('--x', `${e.clientX - r.left}px`)
    el.style.setProperty('--y', `${e.clientY - r.top}px`)
  }

  const style = {
    '--x': '50%',
    '--y': '50%',
    '--size': `${size}px`,
    '--hue': hue,
    '--sat': `${sat}%`,
    '--light': `${light}%`,
  } as CSSProperties

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      style={style}
      className={cn('spotlight-card group/spot relative', className)}
    >
      {/* Surface wash — a faint fill that brightens toward the cursor. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background:
            'radial-gradient(var(--size) var(--size) at var(--x) var(--y), hsl(var(--hue) var(--sat) var(--light) / 0.10), transparent 60%)',
        }}
      />
      {/* Border glow — a bright ring masked to the 1px edge, following the cursor. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          padding: '1px',
          background:
            'radial-gradient(calc(var(--size) * 0.8) calc(var(--size) * 0.8) at var(--x) var(--y), hsl(var(--hue) var(--sat) var(--light) / 0.7), transparent 60%)',
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      {children}
    </div>
  )
}
