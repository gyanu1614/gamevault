/**
 * HubSellerCta (exported as SabSellerCta for back-compat) — the founding-seller
 * pitch band for any game content hub (values, calculator, per-item, blog).
 *
 * Now a thin wrapper over the shared HubCtaBand — the SAME long horizontal band
 * the buy CTA uses — so buy and sell read as one family. Minimal, catchy copy
 * (a seller reads one line and clicks); the button is "Sell {Game}".
 *
 * Backdrop: the game's ONE CTA image (`getGameCtaImage` — the admin upload,
 * then the static art), the same image as the buy band so buy + sell read as
 * one family; if nothing loads, HubCtaBand falls back to the clean scrim.
 * Async SERVER component (cached, cookie-free read; pages stay static).
 *
 * Placement rule (callers): render BELOW the price/verdict content — the
 * buyer's answer comes first; the seller ask is skippable.
 */

import { HubCtaBand } from '@/components/content/HubCtaBand'
import { getGameCtaImage } from '@/lib/content/game-cta-art.server'
import { foundingHref } from '@/lib/seo/founding-href'

interface HubSellerCtaProps {
  /** Game slug — the /early-seller source tag + the per-game backdrop file. */
  gameSlug: string
  /** Display name for the copy ("Sell Adopt Me"). */
  gameName: string
  /** `src` tags the funnel source so we can tell which surface converts. */
  src: string
}

export async function SabSellerCta({ gameSlug, gameName, src }: HubSellerCtaProps) {
  // Shared with the buy band and the category-page guide: one image per game.
  const bgSrc = await getGameCtaImage(gameSlug)

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
      ctaHref={foundingHref(src)}
    />
  )
}
