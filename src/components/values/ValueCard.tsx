'use client'

import Link from '@/components/navigation/AppLink'
import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { ValueArt } from './ValueArt'
import { VALUE_LABEL, VALUE_SURFACE_LINK } from './styles'

/**
 * One value-list card for every hub (SAB brainrots, Adopt Me pets, generic).
 * Header (rank / tags left, rarity right) → art + name (+ optional sub line)
 * → optional control (variant pill) → footer stat pair. Art/name and footer
 * link to the item page when `href` is set; the control + overlay never
 * navigate. `isolate` keeps the overlay's z-index inside the card so toolbar
 * dropdowns always sit above an open picker.
 */
export function ValueCard({
  href,
  headerLeft,
  headerRight,
  imageSrc,
  imageAlt,
  pixelated = false,
  name,
  sub,
  control,
  footer,
  overlay,
}: {
  href: string | null
  headerLeft?: ReactNode
  headerRight?: ReactNode
  imageSrc: string | null | undefined
  imageAlt: string
  pixelated?: boolean
  name: string
  sub?: ReactNode
  control?: ReactNode
  footer: ReactNode
  overlay?: ReactNode
}) {
  return (
    <div className={`group relative isolate flex flex-col overflow-hidden ${VALUE_SURFACE_LINK}`}>
      <div className="flex min-h-[18px] items-center justify-between gap-2 px-3 pt-2.5">
        <span className="flex min-w-0 items-center gap-1.5">{headerLeft}</span>
        <span className="min-w-0 truncate">{headerRight}</span>
      </div>

      <Body href={href} className="flex flex-1 flex-col">
        <div className="flex h-[86px] items-center justify-center px-3 pt-1">
          <ValueArt
            src={imageSrc}
            alt={imageAlt}
            size={74}
            pixelated={pixelated}
            className="transition-transform duration-300 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        </div>
        <div className="px-3 pb-2 pt-1 text-center">
          <div className="truncate text-[14.5px] font-medium leading-5 tracking-[-0.01em] text-text-primary">{name}</div>
          {sub && <div className="truncate text-[12px] font-medium leading-4">{sub}</div>}
        </div>
      </Body>

      {control && <div className="px-3 pb-2.5">{control}</div>}

      <Body href={href} className="mt-auto block">{footer}</Body>

      {overlay}
    </div>
  )
}

/** Link when the item has a page, plain block otherwise (never a 404 link).
 *  Top-level so React keeps the subtree mounted across renders. */
function Body({ href, children, className }: { href: string | null; children: ReactNode; className: string }) {
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  )
}

/** Rank number for the card header. */
export function CardRank({ rank }: { rank: number }) {
  return <span className="text-[11px] font-medium tabular-nums text-text-tertiary">#{rank}</span>
}

/** "Popular" tag (one style across hubs). */
export function PopularTag() {
  return (
    <span className="rounded bg-[#4FB477]/[0.14] px-1.5 py-0.5 text-[10px] font-semibold text-[#6FD495]">
      Popular
    </span>
  )
}

/** Rarity label in its colour (Title Case, no tracking). */
export function RarityLabel({ label, color }: { label: string; color: string }) {
  return (
    <span className="text-[11px] font-semibold" style={{ color }}>
      {label}
    </span>
  )
}

/**
 * Footer band with one or two stats split by a hairline. Stats with a null
 * value render "-"; `empty` replaces the whole band (e.g. "No Sales Yet").
 */
export function PriceStatPair({
  stats,
  empty,
}: {
  stats: Array<{ label: string; value: string | null; color?: string; sub?: ReactNode }>
  empty?: string | null
}) {
  if (empty) {
    return (
      <div className="border-t border-white/[0.07] bg-[#17181C] px-2 py-3 text-center text-[12px] font-medium text-text-tertiary">
        {empty}
      </div>
    )
  }
  return (
    <div className="flex border-t border-white/[0.07] bg-[#17181C]">
      {stats.map((s, i) => (
        <div key={s.label} className="flex flex-1">
          {i > 0 && <div aria-hidden className="my-2 w-px bg-white/[0.07]" />}
          <div className="min-w-0 flex-1 px-1.5 py-2 text-center">
            <div className={VALUE_LABEL}>{s.label}</div>
            <div
              className="truncate text-[16px] font-semibold leading-6 tabular-nums tracking-[-0.01em]"
              style={{ color: s.color ?? 'var(--color-text-primary)' }}
            >
              {s.value ?? '-'}
            </div>
            {s.sub && <div className="text-[10px] tabular-nums text-text-tertiary">{s.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Flat pill that opens a card's variant / mutation picker. */
export function VariantPill({
  label,
  color,
  expanded,
  onToggle,
  ariaLabel,
}: {
  label: string
  color?: string
  expanded: boolean
  onToggle: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      className="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-bg-overlay px-3 text-[13px] font-semibold text-text-primary transition-[background-color,transform] hover:bg-bg-overlay-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      {color && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="truncate">{label}</span>
      <CaretDownIcon aria-hidden size={13} weight="bold" className="shrink-0 text-text-tertiary" />
    </button>
  )
}

/** In-card picker overlay: covers the card, fades in, closes on ✕ / Escape /
 *  a tap outside the card. */
export function CardPickerOverlay({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      // The overlay fills its card, so "outside the overlay" = outside the card.
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-label={title}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
          }}
          className="absolute inset-0 z-30 flex flex-col rounded-lg bg-[#1A1B1F]/[0.98] p-3"
        >
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <span className="text-[12px] font-semibold text-text-secondary">{title}</span>
            <button
              type="button"
              autoFocus
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClose()
              }}
              aria-label={`Close ${title.toLowerCase()}`}
              className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <XIcon size={14} weight="bold" />
            </button>
          </div>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
