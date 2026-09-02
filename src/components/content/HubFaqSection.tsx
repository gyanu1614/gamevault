import type { ReactNode } from 'react'
import { FaqCards } from '@/components/marketplace/FaqCards'

/**
 * HubFaqSection — the ONE FAQ block used across every content-hub page (values,
 * calculator, and any future SEO page). It owns the standard treatment so the
 * pattern can't drift page-to-page:
 *   - separated from the content above by a hairline + generous top space
 *   - a CENTERED title (text-heading) with an optional centered subtitle
 *   - the FaqCards accordion in the game's square/forest geometry
 *   - an optional centered CTA below the accordion
 *
 * Emit the matching FAQPage JSON-LD from the page (schema must mirror the
 * rendered Q&As exactly) — this component only renders the visible FAQ.
 */
export function HubFaqSection({
  title,
  subtitle,
  items,
  footer,
}: {
  title: string
  subtitle?: string
  items: { q: string; a: string }[]
  /** Optional centered element below the accordion (e.g. a calculator link). */
  footer?: ReactNode
}) {
  return (
    <section className="mt-16 border-t border-[#1A211A] pt-12">
      <h2 className="text-center text-heading font-bold tracking-tight text-[#F2F6F0]">
        {title}
      </h2>
      {subtitle && (
        <p className="mx-auto mt-3 max-w-2xl text-center text-body-sm text-[#98A398]">
          {subtitle}
        </p>
      )}
      <FaqCards items={items} defaultOpen={0} className="mt-8" square />
      {footer && <div className="mt-8 flex justify-center">{footer}</div>}
    </section>
  )
}
