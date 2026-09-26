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
import { BuyerSteps } from '../components/BuyerSteps'
import { HomeFaq } from '../components/HomeFaq'
import { PreFooterCtaBand } from '../components/PreFooterCtaBand'
import { TrustStrip } from '../components/TrustStrip'

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

        {/* Order per the agreed eight: how-it-works/trust is 4, the seller
            programme is 5. */}
        <BuyerSteps />

        {/* The site's standard fee line (fee-engine copy rule: qualitative,
            never a rate; fee-copy.guard.test.ts requires it on the homepage). */}
        <SellerCta feeLine="Lowest fees for buyers and sellers" />

        <HomeFaq />
      </div>

      {/* Pre-footer CTA band — section 7. Deliberately OUTSIDE `.page-rhythm`:
          it is a full-bleed band that carries its own background, height and
          centring, so inside the measure it would be boxed in and the rhythm
          gap would fight its own spacing. Being outside it also loses the
          rhythm gap entirely, so the separation from the FAQ is set here —
          matching the 128px the rhythm container uses between sections. */}
      <div className="mt-20">
        <PreFooterCtaBand artSrc="/cta-heroes/footer-cta.jpg" />
      </div>

      {/* Proof points, on the page surface directly under the band. */}
      <div className="mt-14 pb-16">
        <TrustStrip />
      </div>
    </div>
  )
}
