import Link from '@/components/navigation/AppLink'
import { ArrowRight } from 'lucide-react'

/**
 * The homepage's section header, exactly (LatestListings / HomeFaq): the
 * global `.section-title` (always centred, sheen + bloom), an optional action
 * pill taken out of flow at the right of the title row (desktop only, like the
 * homepage's Show All), and an optional one-line sub under it. No heading
 * styles of our own (house design checklist, 2026-10-24).
 */
export function SectionHeading({
  id,
  title,
  sub,
  action,
}: {
  id: string
  title: string
  sub?: string | null
  action?: { href: string; label: string } | null
}) {
  return (
    <div>
      <div className="relative">
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="group absolute right-0 top-1/2 hidden h-9 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-md bg-[#1D1E23] px-3.5 text-[13.5px] font-semibold text-text-primary shadow-[0_12px_26px_-14px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[background-color] hover:bg-[#24252B] lg:inline-flex"
          >
            {action.label}
            <ArrowRight aria-hidden className="h-3.5 w-3.5 transition-transform duration-fast group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      {sub && <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-[1.5] text-text-secondary">{sub}</p>}
    </div>
  )
}
