/**
 * HubSellerCta (exported as SabSellerCta for back-compat) — the founding-seller
 * pitch band for any game content hub (values, calculator, per-item, blog).
 *
 * Now a thin wrapper over the shared HubCtaBand — the SAME long horizontal band
 * the buy CTA uses — so buy and sell read as one family. Minimal, catchy copy
 * (a seller reads one line and clicks); the button is "Sell {Game}".
 *
 * Per-game backdrop: drop public/seller-cta/{gameSlug}.png to fill the band;
 * a missing file falls back to the clean forest scrim. Distinct folder from the
 * buy banner (cta-heroes) so buy/sell art can differ.
 *
 * Placement rule (callers): render BELOW the price/verdict content — the
 * buyer's answer comes first; the seller ask is skippable.
 */

import { HubCtaBand } from '@/components/content/HubCtaBand'

interface HubSellerCtaProps {
  /** Game slug — the /early-seller source tag + the per-game backdrop file. */
  gameSlug: string
  /** Display name for the copy ("Sell Adopt Me"). */
  gameName: string
  /** `src` tags the funnel source so we can tell which surface converts. */
  src: string
}

export function SabSellerCta({ gameSlug, gameName, src }: HubSellerCtaProps) {
  return (
    <HubCtaBand
      gameSlug={gameSlug}
      bgSrc={`/seller-cta/${gameSlug}.png`}
      title={
        <>
          Got {gameName} to sell?{' '}
          <span className="text-[#8FBF9C]">Turn it into cash.</span>
        </>
      }
      body="Founding-seller rate, locked for life. You only pay when something sells."
      ctaLabel={`Sell ${gameName}`}
      ctaHref={`/early-seller?src=${src}`}
    />
  )
}
