'use client'

/**
 * BuyButton — the one primary purchase CTA (currency, bundle and listing
 * pages; desktop panels and phone bars).
 *
 * Flat brand green, no glow and no edge lines (owner, 2026-09-30: "no glow,
 * clean and sleek, minimal yet premium"). The life is in the motion: a soft
 * light sweep crosses the face on hover, the fill lifts one step, the arrow
 * nudges, and the press springs (framer-motion). Reduced motion: no sweep,
 * no spring.
 *
 * `BuyButtonFace` is the same look as a <span>, for when the whole tile is
 * already the button (the phone price tile): put `group` on that parent so
 * the sweep follows its hover.
 */

import { forwardRef, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg'

const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13.5px]',
  md: 'h-11 px-4 text-[14px]',
  lg: 'h-12 px-5 text-[15px]',
}

/** The face, for a custom layout (the phone buy bar); pair with <BuySweep />. */
export const FACE =
  'relative isolate inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-md font-bold tracking-[-0.005em] text-white ' +
  'bg-lime transition-colors duration-200 group-hover:bg-lime-hover group-active:bg-lime-pressed'

/** The light sweep: parked off the left edge, crosses on hover. */
export function BuySweep() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 -z-0 w-1/2 -translate-x-[140%] -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)] transition-transform duration-700 ease-out group-hover:translate-x-[260%] motion-reduce:hidden"
    />
  )
}

function Content({ loading, loadingLabel, icon, children }: { loading?: boolean; loadingLabel?: string; icon?: ReactNode; children: ReactNode }) {
  if (loading) {
    return (
      <span className="relative inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {loadingLabel ?? 'Loading Checkout…'}
      </span>
    )
  }
  return (
    <span className="relative inline-flex items-center gap-2">
      {children}
      {icon === undefined ? (
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.5} aria-hidden />
      ) : (
        icon
      )}
    </span>
  )
}

interface BuyButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  /** Trailing icon; defaults to an arrow that nudges on hover. `null` hides it. */
  icon?: ReactNode
  size?: Size
  className?: string
  type?: 'button' | 'submit'
}

export const BuyButton = forwardRef<HTMLButtonElement, BuyButtonProps>(function BuyButton(
  { children, onClick, disabled, loading, loadingLabel, icon, size = 'lg', className, type = 'button' },
  ref,
) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      whileTap={reduce || disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 600, damping: 32 }}
      className={cn(
        'group',
        FACE,
        SIZE[size],
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:group-hover:bg-lime',
        loading && 'cursor-wait',
        className,
      )}
    >
      <BuySweep />
      <Content loading={loading} loadingLabel={loadingLabel} icon={icon}>
        {children}
      </Content>
    </motion.button>
  )
})

/** Same face as a span, for a parent that is itself the button (add `group` to it). */
export function BuyButtonFace({
  children,
  icon,
  size = 'md',
  className,
}: {
  children: ReactNode
  icon?: ReactNode
  size?: Size
  className?: string
}) {
  return (
    <span className={cn(FACE, SIZE[size], 'shrink-0', className)}>
      <BuySweep />
      <Content icon={icon}>{children}</Content>
    </span>
  )
}
