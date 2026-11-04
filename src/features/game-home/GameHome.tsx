/**
 * GameHome — /[gameSlug] for every game, from one GameHomeModel, built on the
 * house sections and rules (house design checklist, 2026-10-24):
 *
 *   header        the category pages' header (logo, game, title, seller prompt) + live facts
 *   offers        currency card, Popular row (pet cards) or Top Selling, Top Selling Accounts (OfferRail)
 *   How It Works  the house bento (HowItWorksBand)
 *   Hot New       values games with new items
 *   Sell          the homepage's seller banners (SellerCta)
 *   Price Moves / Tools / Guides   when the game has the data
 *   Why Buy       the house card (WhyBuyCard)
 *   FAQ, About, payments strip
 *
 * `.page-rhythm` owns the space between sections (no ad-hoc margins); each
 * section opts into the standard page width. A section whose model is empty
 * is left out. Server component; the rails are the only client islands.
 */
import { CurrencyBuyCard } from '@/components/marketplace/CurrencyBuyCard'
import { OfferRail } from '@/components/marketplace/OfferRail'
import HowItWorksBand from '@/components/marketplace/HowItWorksBand'
import { WhyBuyCard } from '@/components/marketplace/WhyBuyCard'
import { FaqSection } from '@/components/marketplace/FaqCards'
import { PaymentsStrip } from '@/components/marketplace/PaymentsStrip'
import { PopularCarousel } from '@/features/item-buy/PopularCarousel'
import { SellerCta } from '@/features/home/components/SellerCta'
import type { GameHomeModel } from './types'
import { Header } from './sections/Header'
import { HotNew } from './sections/HotNew'
import { PriceMoves } from './sections/PriceMoves'
import { Tools } from './sections/Tools'
import { Guides } from './sections/Guides'
import { About } from './sections/About'

const PAGE = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'

export function GameHome({ model }: { model: GameHomeModel }) {
  const { gameSlug, gameName } = model
  return (
    <main className="min-h-screen">
      <div className="page-rhythm pb-20">
        <div className={PAGE}>
          <Header header={model.header} />

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

          {model.popular && (
            <PopularCarousel
              className="mt-12 sm:mt-14"
              id="popular-items"
              heading={model.popular.title}
              items={model.popular.items}
              gameSlug={gameSlug}
              seeAllHref={model.popular.seeAllHref}
            />
          )}

          {model.topSelling.map((row) => (
            <OfferRail key={row.title} title={row.title} seeAllHref={row.seeAllHref} offers={row.offers} gameSlug={gameSlug} gameName={gameName} />
          ))}
        </div>

        <HowItWorksBand title={model.howItWorks.title} highlight={model.howItWorks.highlight} className="py-0 sm:py-0" />

        {model.hotNew && (
          <div className={PAGE}>
            <HotNew model={model.hotNew} gameSlug={gameSlug} gameName={gameName} />
          </div>
        )}

        {/* The homepage's seller section; the fee line is the site's standard (fee-copy rule). */}
        <SellerCta feeLine="Lowest fees for buyers and sellers" />

        {model.priceMoves && (
          <div className={PAGE}>
            <PriceMoves model={model.priceMoves} />
          </div>
        )}

        {model.tools && (
          <div className={PAGE}>
            <Tools model={model.tools} />
          </div>
        )}

        {model.guides && (
          <div className={PAGE}>
            <Guides model={model.guides} />
          </div>
        )}

        <div className={PAGE}>
          <WhyBuyCard gameSlug={gameSlug} subject={gameName} count={model.whyBuy.count} fromPrice={model.whyBuy.fromPrice} />
        </div>

        <div className={PAGE}>
          <FaqSection className="mt-0 sm:mt-0" title={`${gameName} Marketplace FAQ`} sub="Quick answers before you buy or sell." items={model.faq} />
        </div>

        <div className={PAGE}>
          <About model={model.about} />
        </div>
      </div>

      <PaymentsStrip disclaimer={model.trademark} />
    </main>
  )
}
