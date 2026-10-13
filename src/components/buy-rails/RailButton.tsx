'use client'

import type { ReactNode } from 'react'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import Link from '@/components/navigation/AppLink'
import { cn } from '@/lib/utils'

/**
 * The one white button of every buy rail card, phone bar and calculator box.
 * Flat white with a slight bottom edge (it reads as pressable, no glow); on
 * hover a soft light sweep crosses it and the arrow nudges; on press it sinks
 * a step. Reduced motion: no sweep, no nudge, no scale.
 */
export function RailButton({
  href,
  onClick,
  children,
  className,
  arrow = true,
}: {
  href: string
  onClick?: () => void
  children: ReactNode
  className?: string
  arrow?: boolean
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group relative isolate inline-flex touch-manipulation select-none items-center justify-center gap-1.5 overflow-hidden rounded-[6px] bg-white font-semibold text-[#16171B]',
        'shadow-[inset_0_-2px_0_rgba(22,23,27,0.14)] transition-[background-color,transform] duration-150 ease-out',
        'hover:bg-[#F1F2F4] active:translate-y-px active:scale-[0.985] active:bg-[#E4E6EA] motion-reduce:active:transform-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-1/2 -translate-x-[140%] -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(22,23,27,0.07),transparent)] transition-transform duration-700 ease-out group-hover:translate-x-[260%] motion-reduce:hidden"
      />
      <span>{children}</span>
      {arrow && (
        <ArrowForwardRounded
          aria-hidden
          style={{ fontSize: 16 }}
          className="transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        />
      )}
    </Link>
  )
}
