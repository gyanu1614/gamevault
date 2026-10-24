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
import Link from '@/components/navigation/AppLink'
import { CurrencyBuyCard } from '@/components/marketplace/CurrencyBuyCard'
import { OfferRail } from '@/components/marketplace/OfferRail'
import { FaqSection } from '@/components/marketplace/FaqCards'
import { PaymentsMarquee } from '@/components/marketplace/PaymentsMarquee'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import type { GameHomeModel } from './types'
import { Hero } from './sections/Hero'
import { HowBuying } from './sections/HowBuying'

const PAGE = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'

function OpeningSoon({ gameSlug, gameName }: { gameSlug: string; gameName: string }) {
  return (
    <section className={cn('mt-10 rounded-xl px-6 py-12 text-center', MARKET_CARD)}>
      <p className="text-[17px] font-semibold text-text-primary">{gameName} Is Opening Soon</p>
      <p className="mx-auto mt-2 max-w-xl text-[14px] text-text-secondary">No one has listed {gameName} yet. Sellers can start here first.</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/${gameSlug}/sell`}
          className="inline-flex h-11 items-center justify-center rounded-md bg-white px-5 text-[14px] font-semibold text-black transition-colors hover:bg-white/90"
        >
          Sell {gameName}
        </Link>
      </div>
    </section>
  )
}

export function GameHome({ model }: { model: GameHomeModel }) {
  const { gameSlug, gameName } = model
  return (
    <main className="min-h-screen pb-12">
      <div className={PAGE}>
        <Hero hero={model.hero} />

        {model.openingSoon && <OpeningSoon gameSlug={gameSlug} gameName={gameName} />}

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

        <FaqSection title={`${gameName} Marketplace FAQ`} items={model.faq} />
      </div>

      <PaymentsMarquee disclaimer={model.trademark} />
    </main>
  )
}
