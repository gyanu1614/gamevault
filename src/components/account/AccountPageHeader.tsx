/**
 * V21/P7.al — Standard account-page header.
 *
 * Single source of truth for the title block across every sidebar
 * account page (Dashboard, Orders, Offers, Wallet, Feedback, …) so the
 * type scale, alignment, and the left-side logo stay consistent.
 *
 * Logo: a swappable mask SVG from /public/assets/account-icons/<icon>.svg
 * (currentColor → tints lime). Drop your own SVG with the same filename
 * to replace it.
 *
 * V33 — Restyled to the approved Offers-table header: flush-left title
 * (text-[24px], font-extrabold, tight tracking) + subtitle hugging
 * beneath it; the lime icon tile is retired (the `icon` prop is kept so
 * call sites don't churn). `actions` renders on the right.
 */

import { cn } from '@/lib/utils'

interface AccountPageHeaderProps {
  /** Retired (V33) — kept so existing call sites don't churn. */
  icon?: string
  title: string
  subtitle?: string
  /** Right-aligned controls (buttons, etc.). */
  actions?: React.ReactNode
  className?: string
}

export default function AccountPageHeader({
  title,
  subtitle,
  actions,
  className,
}: AccountPageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[24px] font-extrabold tracking-[-0.3px] text-text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13px] text-text-secondary">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  )
}
