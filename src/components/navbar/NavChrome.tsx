'use client'

/**
 * Navbar chrome shared by the bar and its dropdowns (owner, 2026-09-30:
 * "revamp the navbar and the dropdowns of each button").
 *
 *   NavIconButton  the bar's icon triggers (notifications, messages, live
 *                  orders): Phosphor icons, bold at rest and filled while
 *                  their panel is open; a count badge that pops on change.
 *   NavPanel       the floating surface every dropdown uses. Desktop: an
 *                  anchored popover under its trigger. Phones (<sm): a sheet
 *                  attached flush under the 60px bar, page dimmed behind.
 *                  Fill only (card-surface system): no outline, no top
 *                  sheen; a dark edge ring + shadow lift it off the page.
 *                  CSS entrance, not framer (framer stalls mid-fade under
 *                  heavy trees and strands the panel half-visible; V61).
 *   NavPanelHeader title row with an optional right slot.
 *   navMenuRowCls  the 40px menu row (profile menu, Become a Seller row).
 */

import { forwardRef, type ReactNode } from 'react'
import Link from '@/components/navigation/AppLink'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

/** One menu row. `group` lets the leading icon brighten with the label. */
export const navMenuRowCls =
  'group flex h-10 w-full items-center gap-3 rounded-lg px-3 text-[14px] font-medium text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:bg-white/[0.06] focus-visible:text-text-primary focus-visible:outline-none'

/** Leading icon colour for a menu row (tertiary at rest, primary on hover). */
export const navMenuIconCls = 'shrink-0 text-text-tertiary transition-colors group-hover:text-text-primary group-focus-visible:text-text-primary'

export function NavMenuDivider() {
  return <div role="separator" className="mx-3 my-1.5 h-px bg-white/[0.07]" />
}

function CountBadge({ count }: { count: number }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.span
          key={count > 9 ? '9+' : count}
          aria-hidden
          initial={reduce ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 700, damping: 30 }}
          className="pointer-events-none absolute right-[3px] top-[3px] flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E5484D] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#1D1E23] tabular-nums"
        >
          {count > 9 ? '9+' : count}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

interface NavIconButtonProps {
  icon: PhosphorIcon
  label: string
  count?: number
  /** Panel open: icon fills, button holds its hover fill. */
  active?: boolean
  onClick?: () => void
  /** Renders a link instead of a button (Messages). */
  href?: string
  className?: string
}

export const NavIconButton = forwardRef<HTMLButtonElement, NavIconButtonProps>(function NavIconButton(
  { icon: Icon, label, count = 0, active = false, onClick, href, className },
  ref,
) {
  const cls = cn(
    'relative grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white/80 transition-[background-color,color,transform] duration-150 hover:bg-white/[0.07] hover:text-white active:scale-[0.94] max-lg:h-9 max-lg:w-9',
    active && 'bg-white/[0.09] text-white',
    className,
  )
  const aria = count > 0 ? `${label} (${count > 9 ? '9+' : count} new)` : label
  const glyph = <Icon aria-hidden weight={active ? 'fill' : 'bold'} className="h-[21px] w-[21px] max-lg:h-5 max-lg:w-5" />
  if (href) {
    return (
      <Link href={href} aria-label={aria} className={cls}>
        {glyph}
        <CountBadge count={count} />
      </Link>
    )
  }
  return (
    <button ref={ref} type="button" aria-label={aria} aria-expanded={active} onClick={onClick} className={cls}>
      {glyph}
      <CountBadge count={count} />
    </button>
  )
})

export function NavPanel({
  onClose,
  children,
  width = 'sm:w-[420px]',
  position = 'sm:right-0 sm:mt-[27px]',
  className,
}: {
  onClose: () => void
  children: ReactNode
  /** sm+ width utility. */
  width?: string
  /** sm+ horizontal anchor + gap below the bar. */
  position?: string
  className?: string
}) {
  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="animate-fade-in fixed left-0 right-0 top-full h-[100dvh] bg-black/60 sm:hidden"
      />
      <div
        className={cn(
          'fixed inset-x-0 top-full sm:absolute sm:inset-x-auto sm:top-full sm:max-w-[92vw]',
          'animate-in fade-in-0 slide-in-from-top-1 duration-200 sm:zoom-in-95 max-sm:animation-duration-[250ms]',
          width,
          position,
        )}
      >
        <div
          className={cn(
            'relative flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-xl bg-[#1D1E23]',
            'shadow-[0_0_0_1px_rgba(0,0,0,0.55),0_28px_64px_-16px_rgba(0,0,0,0.9)]',
            'max-sm:max-h-[calc(100dvh-60px-env(safe-area-inset-bottom)-16px)] max-sm:rounded-none max-sm:rounded-b-xl',
            className,
          )}
        >
          {children}
        </div>
      </div>
    </>
  )
}

export function NavPanelHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-4">
      <h3 className="text-[15px] font-semibold text-text-primary">{title}</h3>
      {aside}
    </div>
  )
}
