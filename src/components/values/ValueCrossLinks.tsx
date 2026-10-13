import Link from '@/components/navigation/AppLink'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/ssr/CaretLeft'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { VALUE_LABEL, VALUE_SURFACE_LINK } from './styles'

/**
 * The ONE "back to the list · how we value" pair at the end of every value
 * item page (Adopt Me, MM2, SAB, …). E-E-A-T: every cited value links back to
 * the list and to how it is calculated.
 *
 * Phones (owner, 2026-10-12): one row, two compact buttons with the short
 * labels ("All Values" · "Our Method") — two big stacked cards read as bland.
 * sm+: the two-line cards ("Back to / All Adopt Me Values"), unchanged.
 * Server-safe (no hooks).
 */
export function ValueCrossLinks({
  ariaLabel,
  back,
  method,
}: {
  ariaLabel: string
  /** label: "All Adopt Me Values"; short: "All Values" (phones). */
  back: { href: string; label: string; short: string }
  /** label: "How We Value Pets"; short: "Our Method" (phones). */
  method: { href: string; label: string; short: string }
}) {
  const card = `${VALUE_SURFACE_LINK} group flex min-w-0 items-center gap-2 px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:gap-3 sm:px-5 sm:py-4`
  return (
    <nav aria-label={ariaLabel} className="grid grid-cols-2 gap-2 sm:gap-3">
      <Link href={back.href} className={card}>
        <CaretLeftIcon aria-hidden size={18} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:-translate-x-0.5 group-hover:text-text-primary" />
        <span className="min-w-0">
          <span className={`hidden sm:block ${VALUE_LABEL}`}>Back to</span>
          <span className="block truncate text-body-sm font-semibold text-text-primary">
            <span className="sm:hidden">{back.short}</span>
            <span className="hidden sm:inline">{back.label}</span>
          </span>
        </span>
      </Link>
      <Link href={method.href} className={`${card} justify-between`}>
        <span className="min-w-0">
          <span className={`hidden sm:block ${VALUE_LABEL}`}>Our Method</span>
          <span className="block truncate text-body-sm font-semibold text-text-primary">
            <span className="sm:hidden">{method.short}</span>
            <span className="hidden sm:inline">{method.label}</span>
          </span>
        </span>
        <CaretRightIcon aria-hidden size={18} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
      </Link>
    </nav>
  )
}
