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

      {/* Title centred on the section, action link at the right of the same
          row. The link is absolutely positioned rather than a flex sibling:
          as a sibling its width shifts the title off the section's centre,
          and the title must line up with every other centred section title
          on the page. `relative` also lifts content above the grid layer. */}
      <div className="relative">
        <h2 className="section-title">Latest Listings</h2>
        <Link
          href="/browse"
          className="group absolute right-0 top-1/2 hidden -translate-y-1/2 items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary sm:inline-flex"
        >
          Browse Marketplace
          <ArrowRight
            aria-hidden
            className="h-3.5 w-3.5 transition-transform duration-fast group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      <LatestListingsRail listings={listings} />

      {/* Below-rail fallback for narrow screens, where an absolutely
          positioned link would sit on top of the title. */}
      <div className="relative mt-6 flex justify-center sm:hidden">
        <Link
          href="/browse"
          className="group inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          Browse Marketplace
          <ArrowRight
            aria-hidden
            className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      {/* Row 2 — Top Selling Games. Layout shell only for now. */}
      <div className="relative mt-20">
        <div className="relative">
          <h2 className="section-title">Top Selling Games</h2>
          <Link
            href="/browse"
            className="group absolute right-0 top-1/2 hidden -translate-y-1/2 items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary sm:inline-flex"
          >
            All Games
            <ArrowRight
              aria-hidden
              className="h-3.5 w-3.5 transition-transform duration-fast group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        <TopSellingGamesRail />

        <div className="mt-6 flex justify-center sm:hidden">
          <Link
            href="/browse"
            className="group inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            All Games
            <ArrowRight
              aria-hidden
              className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </section>
  )
}
