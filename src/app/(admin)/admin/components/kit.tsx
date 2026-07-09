/**
 * V53 — Admin UI kit.
 *
 * The shared primitives every admin page builds from, codifying the
 * marketplace design language for data-dense admin surfaces:
 *
 *   - Dark neutral surfaces (bg-bg-raised / bg-bg-overlay), hairline
 *     borders, rounded-xl. No glass, no gradients, no purple.
 *   - ONE accent: lime — reserved for primary actions, active states,
 *     and focus. Everything else is neutral or a SEMANTIC status
 *     color (success / warning / error / info).
 *   - Icon chips are neutral tiles with a tinted glyph, never
 *     gradient squares.
 *
 * Pages compose: <PageHeader/> → stat row of <StatCard/> → content in
 * <AdminPanel/> with TABLE_* classes for tabular data.
 */

import Link from 'next/link'
import { type LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react'
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
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-text-primary sm:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[13.5px] text-text-secondary">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
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
        'rounded-xl border border-border-default bg-bg-raised',
        pad && 'p-5 sm:p-6',
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

export function IconChip({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  icon: LucideIcon
  tone?: ChipTone
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const box = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
  const glyph = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-5 w-5' : 'h-[18px] w-[18px]'
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-overlay',
        box,
        className,
      )}
    >
      <Icon className={cn(glyph, CHIP_TEXT[tone])} />
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
  icon?: LucideIcon
  tone?: ChipTone
  /** Percent change vs previous period; renders green up / red down. */
  delta?: number | null
  href?: string
  className?: string
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold uppercase tracking-wider text-text-tertiary">
          {label}
        </span>
        {icon && <IconChip icon={icon} tone={tone} size="sm" />}
      </div>
      <div className="mt-1.5 text-[24px] font-extrabold tabular-nums leading-none text-text-primary">
        {value}
      </div>
      {(sub != null || delta != null) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-text-tertiary">
          {delta != null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold tabular-nums',
                delta >= 0 ? 'text-success' : 'text-error',
              )}
            >
              {delta >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
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
    'block rounded-xl border border-border-default bg-bg-raised p-4 transition-colors',
    href && 'hover:border-border-strong hover:bg-bg-raised-hover',
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
// this repo (tokens lack <alpha-value>). Use the solid -bg tokens plus
// rgba literals for borders.
const BADGE_CLASSES: Record<ChipTone, string> = {
  neutral: 'border-border-default bg-bg-overlay text-text-secondary',
  lime: 'border-lime-tint-border bg-lime-tint-bg text-lime-text',
  success: 'border-[rgba(74,222,128,0.25)] bg-success-bg text-success',
  warning: 'border-[rgba(251,191,36,0.25)] bg-warning-bg text-warning',
  error: 'border-[rgba(248,113,113,0.25)] bg-error-bg text-error',
  info: 'border-[rgba(96,165,250,0.25)] bg-info-bg text-info',
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
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize',
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
  wrap: 'overflow-x-auto',
  table: 'w-full border-collapse text-left',
  th: 'border-b border-border-subtle px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary whitespace-nowrap',
  td: 'border-b border-border-subtle px-4 py-3 text-[13.5px] text-text-secondary align-middle',
  tdPrimary:
    'border-b border-border-subtle px-4 py-3 text-[13.5px] font-semibold text-text-primary align-middle',
  row: 'transition-colors hover:bg-[rgba(28,28,37,0.5)]',
} as const

/* ── Section label ────────────────────────────────────────────────
   Small uppercase divider label used between page sections. */
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
        'mb-3 text-[11.5px] font-semibold uppercase tracking-wider text-text-tertiary',
        className,
      )}
    >
      {children}
    </div>
  )
}
