/**
 * HomePage.
 *
 * Shape (see the section authoring contract in CLAUDE.md):
 *   .page-stage   owns background, overflow and stacking — once, here.
 *   .page-rhythm  full-width flex column, owns vertical rhythm only.
 *   .page-measure a section opts INTO the content measure.
 *
 * Previous composition preserved at
 * `src/features/home/_archive/HomePage.pre-reset.tsx`.
 */

import type { ReactNode } from 'react'
import HowItWorksBand from '@/components/marketplace/HowItWorksBand'
import { PaymentsMarquee } from '@/components/marketplace/PaymentsMarquee'
import { HeroFilm } from '../components/HeroFilm'
import { SellerCta } from '../components/SellerCta'
import { HomeFaq } from '../components/HomeFaq'
import { PreFooterCtaBand } from '../components/PreFooterCtaBand'

/**
 * A server component: the hero film and the other motion sections are client
 * islands of their own. Sections that fetch their own data are still handed
 * in from the route (page.tsx).
 *
 * Owner, 2026-10-06 curation: the same sections as the game hubs, so the site
 * reads as one product: How It Works band, the seller CTA, a six-question FAQ
 * and the payments strip above the footer. The duplicate Top Selling
 * Games rail is gone (Popular Games already shows them).
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
      <div className="page-rhythm">
        {/* Section 1 — a scroll film with its own sticky stage. Its art
            lives inside the stage and fades to the ground before it
            releases, so it needs no -z-10 sibling here. */}
        <HeroFilm />

        {popularGames}

        {latestListings}

        <HowItWorksBand title="How to Buy Game Items Safely" className="py-0 sm:py-0" />

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

      {/* The payment methods the checkout really offers, above the footer like
          every marketplace page. */}
      <PaymentsMarquee />
    </div>
  )
}
