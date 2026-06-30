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
 * Layout mirrors the Offers header: lime-tinted rounded logo tile + title
 * (text-2xl sm:text-3xl, font-bold, text-text-primary) + optional
 * subtitle (text-sm text-text-secondary). `actions` renders on the right.
 */

import { cn } from '@/lib/utils'

interface AccountPageHeaderProps {
  /** Filename (no extension) in /public/assets/account-icons/. */
  icon: string
  title: string
  subtitle?: string
  /** Right-aligned controls (buttons, etc.). */
  actions?: React.ReactNode
  className?: string
}

export default function AccountPageHeader({
  icon,
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
      <div className="flex items-center gap-3.5">
        {/* Lime logo tile — swap the SVG file to rebrand. */}
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-lime-tint-border bg-lime-tint-bg">
          <span
            aria-hidden
            className="h-6 w-6 bg-lime-text"
            style={{
              WebkitMaskImage: `url(/assets/account-icons/${icon}.svg)`,
              maskImage: `url(/assets/account-icons/${icon}.svg)`,
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
            }}
          />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-sm text-text-secondary">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  )
}
