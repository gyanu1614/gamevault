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
import { ArrowDownRight } from '@phosphor-icons/react/dist/ssr/ArrowDownRight'
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr/ArrowUpRight'
import { CaretLeft } from '@phosphor-icons/react/dist/ssr/CaretLeft'
import { CaretRight } from '@phosphor-icons/react/dist/ssr/CaretRight'
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

/* ── Buttons ──────────────────────────────────────────────────────
   The account buttons (40px) plus a compact 32px size for table rows. */
export { accountBtn as adminBtn } from '@/components/account/AccountSurface'

const SM_BASE =
  'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[12.5px] font-semibold ' +
  'transition-[background-color,transform,opacity] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'

export const adminBtnSm = {
  primary: `${SM_BASE} bg-lime text-text-inverse hover:bg-lime-hover`,
  secondary: `${SM_BASE} bg-white/[0.06] text-text-primary hover:bg-white/[0.10]`,
  danger: `${SM_BASE} bg-[color-mix(in_srgb,var(--color-error)_14%,transparent)] text-error hover:bg-[color-mix(in_srgb,var(--color-error)_22%,transparent)]`,
} as const

/** Text field on the page canvas (search boxes above tables). 16px below sm (no iOS zoom). */
export const adminFieldCls =
  'h-10 w-full rounded-md border border-transparent bg-bg-raised px-3.5 text-base text-text-primary placeholder:text-text-disabled ' +
  'transition-colors hover:border-white/[0.08] focus:border-focus-border focus:outline-none focus:ring-2 focus:ring-focus-soft sm:text-[13.5px]'

/* ── Empty state ──────────────────────────────────────────────────
   Inside a panel: a neutral icon tile, one line, an optional hint/action. */
export function AdminEmpty({
  icon: Icon,
  title,
  hint,
  action,
  tone = 'neutral',
  className,
}: {
  icon: AdminIcon
  title: string
  hint?: React.ReactNode
  action?: React.ReactNode
  tone?: ChipTone
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg bg-bg-raised px-6 py-12 text-center', className)}>
      <IconChip icon={Icon} tone={tone} size="lg" className="mb-3.5" />
      <p className="text-[14px] font-semibold text-text-primary">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-text-tertiary">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ── Loading rows ─────────────────────────────────────────────────
   Skeleton rows in a panel, instead of a spinner and "Loading…". */
export function AdminLoadingRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-white/[0.06] overflow-hidden rounded-lg bg-bg-raised', className)} aria-busy aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="skeleton h-9 w-9 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            <div className="skeleton h-3.5 w-40 max-w-[70%] rounded" />
            <div className="skeleton mt-2 h-3 w-56 max-w-[85%] rounded" />
          </div>
          <div className="skeleton h-5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/* ── Pagination ───────────────────────────────────────────────────
   "Showing 1–20 of 240" + prev / five page numbers / next. */
export function AdminPagination({
  page,
  totalPages,
  total,
  limit,
  onPage,
  noun = 'results',
}: {
  page: number
  totalPages: number
  total: number
  limit: number
  onPage: (page: number) => void
  noun?: string
}) {
  if (totalPages <= 1) return null
  const first = Math.max(1, Math.min(page - 2, totalPages - 4))
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => first + i)
  const btn =
    'grid h-9 min-w-9 place-items-center rounded-md px-2 text-[13px] font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-[13px] text-text-tertiary">
        Showing{' '}
        <span className="font-semibold tabular-nums text-text-secondary">
          {(page - 1) * limit + 1}–{Math.min(page * limit, total)}
        </span>{' '}
        of <span className="font-semibold tabular-nums text-text-secondary">{total.toLocaleString()}</span> {noun}
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          className={cn(btn, 'bg-bg-raised text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary')}
        >
          <CaretLeft aria-hidden weight="bold" className="h-4 w-4" />
        </button>
        {pages.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPage(n)}
            aria-current={n === page ? 'page' : undefined}
            className={cn(
              btn,
              n === page
                ? 'bg-white/[0.10] text-text-primary'
                : 'bg-bg-raised text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary',
            )}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
          className={cn(btn, 'bg-bg-raised text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary')}
        >
          <CaretRight aria-hidden weight="bold" className="h-4 w-4" />
        </button>
      </nav>
    </div>
  )
}

/* ── Filter chips ─────────────────────────────────────────────────
   A labelled row of toggle chips. On phones the row scrolls sideways
   (never wraps into a pile); from sm it wraps. Selected = lighter fill. */
export function FilterRow({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <span className="shrink-0 text-[12.5px] font-medium text-text-tertiary">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="-mr-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto pr-4 [scrollbar-width:none] sm:mr-0 sm:flex-wrap sm:overflow-visible sm:pr-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  )
}

export function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium transition-colors',
        selected
          ? 'bg-white/[0.12] text-text-primary'
          : 'bg-bg-raised text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary',
      )}
    >
      {children}
    </button>
  )
}

/* ── Compact fields (settings editors) ────────────────────────────
   A 36px number/text box on a card (one step lighter than the card), and a
   label-above wrapper. 16px text below sm so iOS doesn't zoom. */
export const adminNumCls =
  'h-9 w-full rounded-md border border-transparent bg-bg-overlay px-2.5 text-base tabular-nums text-text-primary ' +
  'placeholder:text-text-disabled transition-colors hover:border-white/[0.08] focus:border-focus-border focus:outline-none ' +
  'focus:ring-2 focus:ring-focus-soft disabled:cursor-not-allowed disabled:opacity-50 sm:text-[13px]'

export function LabeledField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={htmlFor} className="mb-1 block truncate text-[12px] font-medium text-text-tertiary">
        {label}
      </label>
      {children}
    </div>
  )
}

/** A card's title row: title, optional one-line description, optional right slot. */
export function PanelHead({
  title,
  subtitle,
  aside,
  className,
}: {
  title: string
  subtitle?: React.ReactNode
  aside?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0 max-w-2xl">
        <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
        {subtitle && <p className="mt-1 text-[12.5px] leading-relaxed text-text-tertiary">{subtitle}</p>}
      </div>
      {aside}
    </div>
  )
}

/** A native select on the page canvas (filters, sort). 16px below sm (no iOS zoom). */
export const adminSelectCls =
  'h-10 shrink-0 cursor-pointer rounded-md border border-transparent bg-bg-raised px-3 text-base font-medium text-text-primary ' +
  'transition-colors hover:border-white/[0.08] focus:border-focus-border focus:outline-none focus:ring-2 focus:ring-focus-soft ' +
  'sm:text-[13px] [&>option]:bg-bg-raised'
