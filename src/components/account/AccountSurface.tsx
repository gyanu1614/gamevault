/**
 * Account-area surfaces: one look for every sidebar page (Settings, Wallet,
 * Feedback, Refer & Earn, …), the same as the order page's `OrderCard`.
 *
 * - A card is a solid `bg-bg-raised` fill, `rounded-lg`, no outline (owner,
 *   2026-09-28). A hairline appears only where it separates rows inside it.
 * - Controls inside a card sit one step lighter (`bg-bg-overlay`) with no
 *   resting border; focus brightens the edge with the neutral focus tokens.
 * - Cards are `rounded-lg`; controls (inputs, buttons, tabs) are `rounded-md`.
 */

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function AccountCard({
  className,
  padded = true,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return <div className={cn('rounded-lg bg-bg-raised', padded && 'p-5', className)} {...rest} />
}

interface SettingsCardProps {
  title: string
  description?: ReactNode
  /** Rendered at the right of the title row (a status pill, a link). */
  aside?: ReactNode
  /** Left side of the footer bar: a short hint about the card's action. */
  footerHint?: ReactNode
  /** Right side of the footer bar: the card's own action (Save, Update…). */
  footerAction?: ReactNode
  children?: ReactNode
  className?: string
  bodyClassName?: string
  /** `danger` tints the footer bar for destructive cards. */
  tone?: 'default' | 'danger'
  id?: string
}

/**
 * A titled settings card: heading + one-line description, the fields, and an
 * optional footer bar with the card's own action. Each card saves itself, so
 * a change is never mixed up with another section's unsaved edits.
 */
export function SettingsCard({
  title,
  description,
  aside,
  footerHint,
  footerAction,
  children,
  className,
  bodyClassName,
  tone = 'default',
  id,
}: SettingsCardProps) {
  const hasFooter = footerHint != null || footerAction != null
  return (
    <section id={id} className={cn('overflow-hidden rounded-lg bg-bg-raised', className)}>
      <div className={cn('p-5 sm:p-6', bodyClassName)}>
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-tight text-text-primary">{title}</h2>
            {description && (
              <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-text-secondary">{description}</p>
            )}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </header>
        {children && <div className="mt-5">{children}</div>}
      </div>
      {hasFooter && (
        <div
          className={cn(
            'flex flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6',
            tone === 'danger'
              ? 'border-[color-mix(in_srgb,var(--color-error)_22%,transparent)] bg-[color-mix(in_srgb,var(--color-error)_6%,transparent)]'
              : 'border-white/[0.07] bg-black/[0.14]',
          )}
        >
          <div className="min-w-0 text-[12.5px] leading-relaxed text-text-tertiary">{footerHint}</div>
          {footerAction && <div className="flex shrink-0 items-center gap-2 sm:justify-end">{footerAction}</div>}
        </div>
      )}
    </section>
  )
}

/** Label above the control, hint or error below it. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  trailing,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  /** Right-aligned next to the label (e.g. a character counter). */
  trailing?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-text-secondary">
          {label}
          {required && <span className="ml-0.5 text-error" aria-hidden>*</span>}
        </label>
        {trailing && <span className="text-[12px] tabular-nums text-text-tertiary">{trailing}</span>}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-[12.5px] text-error">{error}</p>
      ) : hint ? (
        <p className="text-[12.5px] leading-relaxed text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  )
}

/**
 * Text input on a card. 16px below `sm` so iOS Safari doesn't zoom on focus
 * (see mobile-friendly-touch), 14px from `sm`.
 */
export const accountInputCls =
  'w-full rounded-md border border-transparent bg-bg-overlay px-3.5 py-2.5 text-base text-text-primary ' +
  'placeholder:text-text-disabled transition-colors hover:border-white/[0.08] sm:text-sm ' +
  'focus:border-focus-border focus:outline-none focus:ring-2 focus:ring-focus-soft ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-transparent'

export const accountBtn = {
  primary:
    'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-lime px-4 text-[13px] font-semibold text-text-inverse ' +
    'transition-[background-color,transform,opacity] hover:bg-lime-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
  secondary:
    'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-white/[0.06] px-4 text-[13px] font-semibold text-text-primary ' +
    'transition-[background-color,transform,opacity] hover:bg-white/[0.10] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
  danger:
    'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[color-mix(in_srgb,var(--color-error)_14%,transparent)] px-4 text-[13px] font-semibold text-error ' +
    'transition-[background-color,transform,opacity] hover:bg-[color-mix(in_srgb,var(--color-error)_22%,transparent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
} as const

/**
 * The page frame every sidebar page uses: the standard max-w-7xl container
 * (standard-page-width). The layout already adds the navbar gap on top.
 */
export function AccountPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('pb-12', className)}>
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 md:max-w-7xl lg:px-8">{children}</div>
    </div>
  )
}

export interface Stat {
  label: string
  value: ReactNode
  /** Small line under the value (a caption, or a delta). */
  hint?: ReactNode
}

/**
 * Headline numbers as ONE panel with hairlines between cells (the wallet's
 * balance panel), not a row of separate boxed cards.
 */
export function StatStrip({ stats, loading, className }: { stats: Stat[]; loading?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/[0.07]',
        stats.length >= 4 ? 'lg:grid-cols-4' : stats.length === 3 ? 'lg:grid-cols-3' : '',
        className,
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 bg-bg-raised px-4 py-4 sm:px-5">
          <p className="truncate text-[12.5px] font-medium text-text-secondary">{stat.label}</p>
          {loading ? (
            <div className="skeleton mt-2 h-7 w-24 rounded" aria-hidden />
          ) : (
            <p className="mt-1 truncate text-[24px] font-bold leading-tight tabular-nums text-text-primary">{stat.value}</p>
          )}
          {loading ? (
            <div className="skeleton mt-2 h-3 w-20 rounded" aria-hidden />
          ) : stat.hint ? (
            <div className="mt-1 truncate text-[12px] text-text-tertiary">{stat.hint}</div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/** A clickable row inside a card (orders, attention items, …). */
export const accountRowCls =
  'flex items-center gap-3 rounded-md bg-bg-overlay px-3.5 py-3 transition-colors hover:bg-bg-overlay-2'
