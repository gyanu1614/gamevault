/**
 * Admin UI kit (account-section design, 2026-09-30 overhaul).
 *
 * The shared primitives every admin page builds from:
 *
 *   - Cards are solid fills (bg-bg-raised, rounded-lg) with NO outline,
 *     gradient or glow; hairlines only between rows. Controls inside a card
 *     sit one step lighter (bg-bg-overlay / white 5%).
 *   - ONE accent: lime, for primary actions and the active nav item. Status
 *     colours are semantic (success / warning / error / info), as fills.
 *   - Icons are Phosphor, bold. Labels are Title Case (no uppercase eyebrows).
 *
 * Pages compose: <PageHeader/> → stat row of <StatCard/> → content in
 * <AdminPanel/> with TABLE_* classes for tabular data.
 */

import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

/* ── Page header ──────────────────────────────────────────────────
   Title row every route starts with: title + one-line description on
   the left, optional actions (buttons/filters) on the right. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6', className)}>
      <div className="min-w-0">
        <h1 className="text-[24px] font-bold leading-tight tracking-tight text-text-primary sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[13.5px] leading-relaxed text-text-secondary">{description}</p>
        )}
      </div>
      {actions && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ── Panel surface ────────────────────────────────────────────────
   The standard content card. `pad={false}` for flush tables. */
export function AdminPanel({
  children,
  className,
  pad = true,
}: {
  children: React.ReactNode
  className?: string
  pad?: boolean
}) {
  return (
    <section
      className={cn(
        'rounded-lg bg-bg-raised',
        pad && 'p-4 sm:p-6',
        className,
      )}
    >
      {children}
    </section>
  )
}

/* ── Icon chip ────────────────────────────────────────────────────
   Neutral tile + tinted glyph. `tone` picks the glyph tint only —
   the tile itself stays neutral so rows of chips read calm. */
export type ChipTone = 'neutral' | 'lime' | 'success' | 'warning' | 'error' | 'info'

const CHIP_TEXT: Record<ChipTone, string> = {
  neutral: 'text-text-secondary',
  lime: 'text-lime-text',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  info: 'text-info',
}

/** Any icon component: Phosphor (preferred; drawn bold) or a legacy lucide one. */
export type AdminIcon = React.ComponentType<any>

export function IconChip({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  icon: AdminIcon
  tone?: ChipTone
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const box = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
  const glyph = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-5 w-5' : 'h-[18px] w-[18px]'
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md bg-white/[0.05]',
        box,
        className,
      )}
    >
      <Icon aria-hidden weight="bold" className={cn(glyph, CHIP_TEXT[tone])} />
    </span>
  )
}

/* ── Stat card ────────────────────────────────────────────────────
   Metric tile: label, value, optional sub-line and delta. */
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'neutral',
  delta,
  href,
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: AdminIcon
  tone?: ChipTone
  /** Percent change vs previous period; renders green up / red down. */
  delta?: number | null
  href?: string
  className?: string
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12.5px] font-medium text-text-secondary">
          {label}
        </span>
        {icon && <IconChip icon={icon} tone={tone} size="sm" />}
      </div>
      <div className="mt-1.5 truncate text-[24px] font-bold tabular-nums leading-tight text-text-primary">
        {value}
      </div>
      {(sub != null || delta != null) && (
        <div className="mt-1 flex items-center gap-1.5 truncate text-[12px] text-text-tertiary">
          {delta != null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold tabular-nums',
                delta >= 0 ? 'text-success' : 'text-error',
              )}
            >
              {delta >= 0 ? (
                <ArrowUpRight aria-hidden weight="bold" className="h-3 w-3" />
              ) : (
                <ArrowDownRight aria-hidden weight="bold" className="h-3 w-3" />
              )}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {sub}
        </div>
      )}
    </>
  )
  const surface = cn(
    'block min-w-0 rounded-lg bg-bg-raised p-4 transition-colors',
    href && 'hover:bg-bg-raised-hover',
    className,
  )
  if (href) {
    return (
      <Link href={href} className={surface}>
        {body}
      </Link>
    )
  }
  return <div className={surface}>{body}</div>
}

/* ── Status badge ─────────────────────────────────────────────────
   One mapping for every status word the admin shows. Unknown words
   fall back to neutral so new statuses never explode. */
const STATUS_TONE: Record<string, ChipTone> = {
  // greens
  completed: 'success', approved: 'success', active: 'success', resolved: 'success',
  released: 'success', paid: 'success', delivered: 'success', verified: 'success',
  // ambers
  pending: 'warning', processing: 'warning', under_review: 'warning', review: 'warning',
  escalated: 'warning', held: 'warning', flagged: 'warning', awaiting: 'warning',
  // reds
  rejected: 'error', cancelled: 'error', canceled: 'error', banned: 'error',
  failed: 'error', refunded: 'error', disputed: 'error', suspended: 'error', restricted: 'error',
  // blues
  open: 'info', new: 'info', info: 'info', shipped: 'info',
}

// NOTE: custom-token alpha modifiers (bg-success/10) don't compile in
// this repo (tokens lack <alpha-value>). Use the solid -bg tokens.
// Fill only: no outline.
const BADGE_CLASSES: Record<ChipTone, string> = {
  neutral: 'bg-white/[0.07] text-text-secondary',
  lime: 'bg-lime-tint-bg text-lime-text',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  error: 'bg-error-bg text-error',
  info: 'bg-info-bg text-info',
}

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string
  /** Override the auto mapping when a status word is ambiguous. */
  tone?: ChipTone
  className?: string
}) {
  const resolved =
    tone ?? STATUS_TONE[status.toLowerCase().replace(/[\s-]+/g, '_')] ?? 'neutral'
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold capitalize',
        BADGE_CLASSES[resolved],
        className,
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

/* ── Table classes ────────────────────────────────────────────────
   Not a component (pages own their markup) — shared class strings so
   every table reads identically. */
export const TABLE = {
  wrap: 'overflow-x-auto overscroll-x-contain',
  table: 'w-full border-collapse text-left',
  th: 'border-b border-white/[0.06] px-4 py-3 text-[12px] font-medium text-text-tertiary whitespace-nowrap',
  td: 'border-b border-white/[0.06] px-4 py-3 text-[13.5px] text-text-secondary align-middle',
  tdPrimary:
    'border-b border-white/[0.06] px-4 py-3 text-[13.5px] font-semibold text-text-primary align-middle',
  row: 'transition-colors hover:bg-white/[0.03]',
} as const

/* ── Section label ────────────────────────────────────────────────
   Small Title Case heading between page sections. */
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-3 text-[14px] font-semibold text-text-primary',
        className,
      )}
    >
      {children}
    </div>
  )
}
