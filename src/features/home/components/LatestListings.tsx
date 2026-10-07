/**
 * LatestListings — section 3 of the homepage. Server component.
 *
 * Sets no padding, margin, max-width or overflow: it opts into the page
 * measure and lets the rhythm container own the spacing around it, per the
 * section authoring contract in CLAUDE.md.
 */

import Link from '@/components/navigation/AppLink'
import { ArrowRight } from 'lucide-react'
import { getLatestListings } from '../lib/latest-listings'
import { LatestListingsRail } from './LatestListingsRail'
import { GridSpotlight } from './GridSpotlight'

/** Below this the rail looks broken rather than sparse, so it doesn't render. */
const MIN_LISTINGS = 3

export async function LatestListings() {
  const listings = await getLatestListings(30)

  if (listings.length < MIN_LISTINGS) return null

  return (
    // `relative` is for the grid layer below — the section still sets no
    // padding, margin, max-width, overflow, border or background.
    // The vertical padding here is intra-section composition, NOT inter-
    // section rhythm: it gives the grid backdrop room to read above the
    // first row and below the last, symmetrically. The rhythm container
    // still owns the spacing between this section and its neighbours.
    //
    // overflow-x-clip only: the grid layer is full-bleed and would otherwise
    // widen the page. `clip` leaves the y-axis visible, so the layer still
    // extends above and below the section as intended.
    <section className="page-measure relative overflow-x-clip py-12">
      {/* Grid backdrop — invisible until the pointer enters, then a soft
          patch follows the cursor. Full-bleed and taller than this section,
          so it fades to nothing well before any edge. */}
      <GridSpotlight />

      {/* Title centred on the section, action link at the right of the same
          row. The link is absolutely positioned rather than a flex sibling:
          as a sibling its width shifts the title off the section's centre,
          and the title must line up with every other centred section title
          on the page. `relative` also lifts content above the grid layer. */}
      <div className="relative">
        <h2 className="section-title">Latest Listings</h2>
        {/* The hub's floating "Show All" (owner, 2026-10-06): a raised fill
            and a soft drop shadow, no outline. */}
        <Link
          href="/browse"
          className="group absolute right-0 top-1/2 hidden h-9 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-md bg-[#1D1E23] px-3.5 text-[13.5px] font-semibold text-text-primary shadow-[0_12px_26px_-14px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[background-color] hover:bg-[#24252B] sm:inline-flex"
        >
          Show All
          <ArrowRight
            aria-hidden
            className="h-3.5 w-3.5 transition-transform duration-fast group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      <LatestListingsRail listings={listings} />

      <div className="relative mt-6 flex justify-center sm:hidden">
        <Link
          href="/browse"
          className="group inline-flex h-10 items-center gap-1.5 rounded-md bg-[#1D1E23] px-4 text-[14px] font-semibold text-text-primary shadow-[0_12px_26px_-14px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]"
        >
          Show All Listings
          <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  )
}
