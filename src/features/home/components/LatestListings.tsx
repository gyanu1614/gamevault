/**
 * LatestListings — section 3 of the homepage. Server component.
 *
 * Sets no padding, margin, max-width or overflow: it opts into the page
 * measure and lets the rhythm container own the spacing around it, per the
 * section authoring contract in CLAUDE.md.
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getLatestListings } from '../lib/latest-listings'
import { LatestListingsRail } from './LatestListingsRail'
import { TopSellingGamesRail } from './TopSellingGamesRail'
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

      {/* Heading left, link right — same pattern as any section that has an
          action link (see the section header rule in CLAUDE.md).
          `relative` lifts the content above the grid layer. */}
      <div className="relative flex items-baseline justify-between gap-4">
        <h2 className="min-w-0 truncate text-[18px] font-semibold tracking-[-0.02em] text-text-primary">
          Latest Listings
        </h2>
        {/* shrink-0 + nowrap: without them flex squeezes the link at narrow
            widths and the label breaks across two lines. */}
        <Link
          href="/browse"
          className="group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          Browse Marketplace
          <ArrowRight
            aria-hidden
            className="h-3.5 w-3.5 transition-transform duration-fast group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      <LatestListingsRail listings={listings} />

      {/* Row 2 — Top Selling Games. Layout shell only for now. */}
      <div className="relative mt-14">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="min-w-0 truncate text-[18px] font-semibold tracking-[-0.02em] text-text-primary">
            Top Selling Games
          </h2>
          <Link
            href="/browse"
            className="group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            All Games
            <ArrowRight
              aria-hidden
              className="h-3.5 w-3.5 transition-transform duration-fast group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        <TopSellingGamesRail />
      </div>
    </section>
  )
}
