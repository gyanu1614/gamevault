import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils'

/**
 * The one heading recipe for game-home sections, so no two sections drift.
 *   row      — left-aligned, the OfferRail scale (20→24px), optional action
 *              button on the right (same pill as OfferRail's "Show All");
 *   showcase — centred, the FaqSection scale (22→28px), for the full-width
 *              bands (How Buying Works, Why Players Buy, FAQ).
 */
export function SectionHeading({
  id,
  title,
  sub,
  action,
  variant = 'row',
  className,
}: {
  id: string
  title: string
  sub?: string | null
  action?: { href: string; label: string } | null
  variant?: 'row' | 'showcase'
  className?: string
}) {
  if (variant === 'showcase') {
    return (
      <div className={cn('mx-auto max-w-3xl text-center', className)}>
        <h2 id={id} className="text-balance text-[22px] font-semibold leading-tight tracking-[-0.02em] text-text-primary sm:text-[28px]">
          {title}
        </h2>
        {sub && <p className="mt-2 text-[14px] text-text-secondary sm:text-[15px]">{sub}</p>}
      </div>
    )
  }
  return (
    <div className={cn('mb-5 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-[20px] font-bold tracking-[-0.01em] text-text-primary sm:text-[24px]">
          {title}
        </h2>
        {sub && <p className="mt-1 truncate text-[13.5px] text-text-secondary sm:text-[14.5px]">{sub}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#1D1E23] px-3.5 text-[13.5px] font-semibold text-text-primary shadow-[0_12px_26px_-14px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[background-color,transform] hover:-translate-y-px hover:bg-[#24252B] active:translate-y-0"
        >
          {action.label}
          <ArrowRightIcon size={14} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}
