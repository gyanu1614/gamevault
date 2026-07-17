import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export interface RowHeaderProps {
  title: string
  viewAllHref: string
  /** V17i — Optional small caps eyebrow above the title (e.g. "Trending",
   *  "Marketplace"). Adds context and visual rhythm to the page so each
   *  section reads as its own chapter, not just another row of cards. */
  eyebrow?: string
  /** Optional one-line description shown beneath the title for sections
   *  that need extra context. Kept quiet so it doesn't compete. */
  subtitle?: string
}

export function RowHeader({ title, viewAllHref, eyebrow, subtitle }: RowHeaderProps) {
  return (
    <div className="relative mb-6 flex justify-between items-end gap-4">
      {/* V17i — Decorative left-edge lime bar. Tiny visual depth that
          marks the section as a "chapter" without adding background art
          weight. Matches the eyebrow's lime tint. */}
      <div className="absolute -left-3 top-1 hidden h-8 w-0.5 rounded-full bg-gradient-to-b from-lime/80 via-lime/40 to-transparent sm:block" aria-hidden />

      <div className="relative flex-1 min-w-0">
        {eyebrow && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
              {eyebrow}
            </span>
            <span className="h-px w-8 bg-gradient-to-r from-lime/40 to-transparent" aria-hidden />
          </div>
        )}
        {/* V17p — Standardized at text-display so every section title
            reads at the same scale; was a mix of text-heading and
            text-display before. */}
        <h2 className="font-display text-display">{title}</h2>
        {subtitle && (
          <p className="mt-2 text-body-sm text-text-secondary max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      <Link
        href={viewAllHref}
        className="inline-flex min-h-[44px] items-end gap-1.5 text-body-sm font-semibold text-lime-text flex-none group self-end pb-1"
      >
        View all
        <ArrowRight
          aria-hidden="true"
          className="w-4 h-4 transition-transform duration-fast group-hover:translate-x-[3px]"
        />
      </Link>
    </div>
  )
}
