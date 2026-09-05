/**
 * HubSellerCta (exported as SabSellerCta for back-compat) — the founding-seller
 * pitch band for any game content hub (values, calculator, per-item, blog).
 *
 * Now a thin wrapper over the shared HubCtaBand — the SAME long horizontal band
 * the buy CTA uses — so buy and sell read as one family. Minimal, catchy copy
 * (a seller reads one line and clicks); the button is "Sell {Game}".
 *
 * Per-game backdrop: a dedicated public/seller-cta/{gameSlug}.png fills the band
 * when present (SAB has one). Games without their own seller art reuse the buy
 * banner (public/cta-heroes/{gameSlug}.jpg) so buy + sell read as one family;
 * if neither exists, HubCtaBand falls back to the clean forest scrim.
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

/** Games that ship their own dedicated seller-band art in public/seller-cta/.
 *  Everyone else reuses the buy banner so buy + sell share one look. */
const GAMES_WITH_SELLER_ART = new Set(['steal-a-brainrot'])

export function SabSellerCta({ gameSlug, gameName, src }: HubSellerCtaProps) {
  const bgSrc = GAMES_WITH_SELLER_ART.has(gameSlug)
    ? `/seller-cta/${gameSlug}.png`
    : `/cta-heroes/${gameSlug}.jpg`

  return (
    <HubCtaBand
      gameSlug={gameSlug}
      bgSrc={bgSrc}
      bgOpacity={0.5}
      rightScrim
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
