'use client'

import { useRef, type PointerEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The pet page's desktop surface (owner, 2026-11-03, GameBoost's panel as the
 * reference): frosted over the game art, so the colours come through but the
 * picture behind cannot be read. Desktop only: on phones these classes do
 * nothing and the content floats on the page.
 */
export const GLASS =
  'lg:rounded-lg lg:bg-[rgba(28,29,35,0.66)] lg:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_24px_60px_-32px_rgba(0,0,0,0.9)] lg:backdrop-blur-[30px] lg:backdrop-saturate-150'

/**
 * A glass panel with a quiet hover: the edge brightens and a soft light follows
 * the pointer. Nothing moves (house rule). The light is a CSS variable set on
 * the element, so moving the pointer never re-renders the page.
 */
export function GlassPanel({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const box = el.getBoundingClientRect()
    el.style.setProperty('--glass-x', `${e.clientX - box.left}px`)
    el.style.setProperty('--glass-y', `${e.clientY - box.top}px`)
  }
  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className={cn(
        'group/glass lg:relative lg:transition-shadow lg:duration-300',
        GLASS,
        'lg:hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16),0_24px_60px_-32px_rgba(0,0,0,0.9)]',
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/glass:opacity-100 motion-reduce:hidden lg:block"
        style={{ background: 'radial-gradient(460px circle at var(--glass-x, 50%) var(--glass-y, 0%), rgba(255,255,255,0.055), transparent 70%)' }}
      />
      {children}
    </div>
  )
}
