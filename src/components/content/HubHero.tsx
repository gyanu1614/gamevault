/**
 * HubHero — the single source of truth for every content-hub page header
 * (Values, Calculator, Blog, Sell, guides…). One recipe so all hubs share the
 * SAME title size, body size, top spacing, container width and centering —
 * change it here and every hub moves together.
 *
 * The canonical reference is the WFL Calculator hero; these values are lifted
 * verbatim from it:
 *   - clearance:  HUB_NAV_CLEAR  (nav height + a comfortable gap)
 *   - container:  max-w-7xl, standard page gutter, centred
 *   - title:      30px → 42px  (NO 52/54px large-screen jump — that read as
 *                 "why is the title so big"; the cap stays at 42)
 *   - body:       15px → 17px, mt-3, max-w-2xl
 *
 * Server component (no interactivity) so it drops into any hub page. Anything
 * bespoke a page needs BELOW the lead (buttons, badges, backdrops) stays on the
 * page; this owns only the shared eyebrow + title + lead block.
 */

import type { ReactNode } from 'react'
import { HUB_NAV_CLEAR } from '@/components/content/hubNavGeometry'

export function HubHero({
  title,
  lead,
  eyebrow,
  children,
}: {
  title: ReactNode
  /** One line of context under the title. Optional — a few hubs run title-only. */
  lead?: ReactNode
  /** Small uppercase kicker above the title (icon + label, etc.). Optional. */
  eyebrow?: ReactNode
  /** Anything that sits BELOW the lead, still centred (CTA button, badges). */
  children?: ReactNode
}) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
      <div className="flex flex-col items-center text-center">
        {eyebrow ? <div className="mb-4">{eyebrow}</div> : null}
        <h1 className="text-balance text-[30px] font-bold leading-[1.05] tracking-[-0.02em] text-[#F2F6F0] sm:text-[42px]">
          {title}
        </h1>
        {lead ? (
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-[15px] leading-7 text-[#98A398] sm:text-[17px]">
            {lead}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  )
}
