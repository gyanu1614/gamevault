'use client'

/**
 * HomePage — rebuild in progress.
 *
 * Shape (see the section authoring contract in CLAUDE.md):
 *   .page-stage   owns background, overflow and stacking — once, here.
 *   HomeHeroArt   sits OUTSIDE the rhythm container as a -z-10 sibling, so
 *                 the art is never clipped by a section boundary.
 *   .page-rhythm  full-width flex column, owns vertical rhythm only.
 *   .page-measure a section opts INTO the content measure.
 *
 * Previous composition preserved at
 * `src/features/home/_archive/HomePage.pre-reset.tsx`.
 */

import type { ReactNode } from 'react'
import { HomeHeroArt } from '../components/HomeHeroArt'
import { HomeHero } from '../components/HomeHero'
import { SellerCta } from '../components/SellerCta'

/**
 * Sections that fetch their own data are rendered on the server and passed
 * in as children. This page is a client component (the hero art needs
 * pointer parallax), and a client component cannot render an async server
 * child directly — but it can render one handed to it as a prop.
 */
export function HomePage({
  popularGames,
  latestListings,
}: {
  popularGames?: ReactNode
  latestListings?: ReactNode
}) {
  return (
    <div className="page-stage">
      {/* Hero art — sibling of the rhythm container, not inside a section. */}
      <HomeHeroArt backdropSrc="/hero/home.avif" />

      <div className="page-rhythm">
        <HomeHero />

        {/* Section 2 pulls up into the lower half of the hero art, which is
            why the art runs past the hero section. */}
        {popularGames}

        {latestListings}

        <SellerCta />

        {/* Scroll room only — no placeholder box. An empty section renders
            nothing rather than an empty bordered container. */}
        <div className="h-[40vh]" aria-hidden />
      </div>
    </div>
  )
}
