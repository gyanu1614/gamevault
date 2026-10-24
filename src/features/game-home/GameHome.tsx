/**
 * GameHome — /[gameSlug] for every game, from one GameHomeModel. Sections
 * render in a fixed order and each one is left out when its model is empty,
 * so a game without values data, tools or guides simply gets a shorter page.
 *
 * Server component: every link and every slide is in the HTML. Motion is CSS
 * (game-home.css), off under reduced motion; the rails are the only client
 * islands (OfferRail, and the Embla rails added per section).
 */
import './game-home.css'
import { CurrencyBuyCard } from '@/components/marketplace/CurrencyBuyCard'
import { OfferRail } from '@/components/marketplace/OfferRail'
import { FaqSection } from '@/components/marketplace/FaqCards'
import { PaymentsMarquee } from '@/components/marketplace/PaymentsMarquee'
import type { GameHomeModel } from './types'
import { Hero } from './sections/Hero'
import { HowBuying } from './sections/HowBuying'
import { HotNew } from './sections/HotNew'
import { StartSelling } from './sections/StartSelling'
import { PriceMoves } from './sections/PriceMoves'

const PAGE = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'

export function GameHome({ model }: { model: GameHomeModel }) {
  const { gameSlug, gameName } = model
  return (
    <main className="min-h-screen pb-12">
      <div className={PAGE}>
        <Hero hero={model.hero} />

        {model.currency && (
          <CurrencyBuyCard
            className="mt-8"
            gameName={gameName}
            name={model.currency.name}
            href={model.currency.href}
            iconUrl={model.currency.iconUrl}
            accent={model.currency.accent}
            fromLabel={model.currency.fromLabel}
            avgDelivery={model.currency.avgDelivery}
          />
        )}

        {model.topSelling.map((row) => (
          <OfferRail key={row.title} title={row.title} seeAllHref={row.seeAllHref} offers={row.offers} gameSlug={gameSlug} gameName={gameName} />
        ))}

        <HowBuying gameName={gameName} itemNoun={model.itemNoun} itemNounSingular={model.itemNounSingular} />

        {model.hotNew && <HotNew model={model.hotNew} gameName={gameName} />}

        <StartSelling model={model.startSelling} />

        {model.priceMoves && <PriceMoves model={model.priceMoves} />}

        <FaqSection title={`${gameName} Marketplace FAQ`} items={model.faq} />
      </div>

      <PaymentsMarquee disclaimer={model.trademark} />
    </main>
  )
}
