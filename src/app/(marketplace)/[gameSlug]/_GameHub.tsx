/**
 * The game hub: /fortnite, /roblox, … (every game but Steal a Brainrot, which
 * keeps its values landing). Owner, 2026-09-30: keep /{game} as the landing
 * page and rebuild it properly (it ranks for the broad "{game} marketplace"
 * searches; every category page's breadcrumb points here).
 *
 *   Header      game logo + name + one-line pitch + three facts
 *   Buy card    the game's currency (CurrencyBuyCard: icon art, tinted in its colour)
 *   Offer rows  Top Selling Items, Top Selling Accounts (carousels, Show All)
 *   Categories  centred floating buttons, no heading
 *   Sell        "Start Making Money Today" over the seller-application art
 *   How it works, FAQ (searched questions), Why Buy, blog, payments
 *
 * Owner, 2026-10-06: this order, the "Buy and Sell <Game> on DropMarket"
 * block and its chips removed, the Shop by Category grid moved down as buttons.
 *
 * Server component: every link is in the HTML. Entrance motion is CSS-only
 * (visible without JavaScript, off under reduced motion). Fill-only cards on
 * the marketplace card gradient; green only on the Buy button.
 */

import Link from '@/components/navigation/AppLink'
import type { ReactNode } from 'react'
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  ShieldCheckIcon,
  SealCheckIcon,
  TagIcon,
  StorefrontIcon,
  PackageIcon,
} from '@phosphor-icons/react/dist/ssr'
import HowItWorksBand, { type HowItWorksHighlight } from '@/components/marketplace/HowItWorksBand'
import { FaqSection } from '@/components/marketplace/FaqCards'
import { CurrencyBuyCard } from '@/components/marketplace/CurrencyBuyCard'
import { WhyBuyCard } from '@/components/marketplace/WhyBuyCard'
import { PaymentsMarquee } from '@/components/marketplace/PaymentsMarquee'
import { OfferRail } from '@/components/marketplace/OfferRail'
import { cn } from '@/lib/utils'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import type { HubCard } from './_hubModel'
import type { ItemOffer } from './[categorySlug]/_itemsTypes'

const CARD = MARKET_CARD
const CARD_HOVER = MARKET_CARD_HOVER
/** CSS entrance: rises in once, staggered by `delay` (ms). */
const RISE = 'animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500 motion-reduce:animate-none'

/** House category glyphs are single-colour SVGs: draw them white via mask. */
function CategoryGlyph({ src, className }: { src: string; className?: string }) {
  if (src.startsWith('/icons/categories/')) {
    return (
      <span
        aria-hidden
        className={cn('inline-block bg-white/85', className)}
        style={{
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
        }}
      />
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden loading="lazy" decoding="async" className={cn('object-contain', className)} />
}

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/[0.05] px-2.5 text-[13px] font-medium text-text-secondary">
      <span className="text-text-tertiary">{icon}</span>
      {children}
    </span>
  )
}

function HubHeader({
  gameName,
  gameImageUrl,
  pitch,
  totalOffers,
}: {
  gameName: string
  gameImageUrl: string | null
  pitch: string
  totalOffers: number
}) {
  return (
    <header className={cn('pt-2 sm:pt-3', RISE)}>
      <div className="flex items-center gap-3.5 sm:gap-5">
        {gameImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gameImageUrl}
            alt=""
            width={72}
            height={72}
            className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-[72px] sm:w-[72px]"
          />
        ) : (
          <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-white/[0.05] sm:h-[72px] sm:w-[72px]">
            <PackageIcon size={26} weight="bold" className="text-text-secondary" />
          </span>
        )}
        <div className="min-w-0">
          <p className="mb-1.5 text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-text-secondary sm:text-[14px]">
            Marketplace
          </p>
          <h1
            className="font-black tracking-tight text-text-primary"
            style={{ fontSize: 'var(--fs-page-title)', lineHeight: 1.05, fontWeight: 'var(--fw-heading)', letterSpacing: '-0.02em' }}
          >
            {gameName}
          </h1>
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-secondary">{pitch}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {totalOffers > 0 && (
          <Fact icon={<TagIcon size={14} weight="bold" />}>
            <span className="font-semibold tabular-nums text-text-primary">{totalOffers.toLocaleString('en-US')}</span>
            {totalOffers === 1 ? 'Offer Live' : 'Offers Live'}
          </Fact>
        )}
        <Fact icon={<ShieldCheckIcon size={14} weight="bold" />}>SafeDrop Protection</Fact>
        <Fact icon={<SealCheckIcon size={14} weight="bold" />}>Verified Sellers</Fact>
      </div>
    </header>
  )
}

/**
 * The How It Works price tile on a hub: the currency's "from" price with its
 * icon (Robux from $X) when the game has a currency, else the live offer
 * count. Either way over the game's art.
 */
function hubHighlight({
  spotlight,
  currencyIconUrl,
  gameImageUrl,
  gameName,
  totalOffers,
}: {
  spotlight: HubCard | null
  currencyIconUrl: string | null
  gameImageUrl: string | null
  gameName: string
  totalOffers: number
}): HowItWorksHighlight | null {
  if (spotlight?.fromLabel) {
    const icon = currencyIconUrl || (spotlight.icon.startsWith('/icons/categories/') ? null : spotlight.icon)
    // "$0.0052/Robux" → "$0.0052" big, "per Robux" in the small line.
    const [price, per] = spotlight.fromLabel.split('/')
    const offers = `${spotlight.count.toLocaleString('en-US')} ${spotlight.count === 1 ? 'offer' : 'offers'} live now`
    return {
      label: `${spotlight.name} from`,
      value: price,
      note: per ? `per ${per} · ${offers}` : offers,
      iconUrl: icon,
      backdropUrl: gameImageUrl,
    }
  }
  if (totalOffers <= 0) return null
  return {
    label: `${gameName} on DropMarket`,
    value: `${totalOffers.toLocaleString('en-US')} ${totalOffers === 1 ? 'Offer' : 'Offers'} Live`,
    note: 'From ID-verified sellers',
    backdropUrl: gameImageUrl,
  }
}

/** Every category as a centred, floating button (no heading; owner, 2026-10-06). */
function CategoryButtons({ cards, gameName }: { cards: HubCard[]; gameName: string }) {
  return (
    <nav aria-label={`${gameName} categories`} className="mt-12 sm:mt-14">
      <ul className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
        {cards.map((card, i) => (
          <li key={card.id} className={RISE} style={{ animationDelay: `${80 + i * 40}ms` }}>
            <Link
              href={card.href}
              className={cn(
                'group inline-flex h-12 items-center gap-2.5 rounded-lg bg-[#1D1E23] pl-2 pr-4 text-[14.5px] font-semibold text-text-primary',
                'shadow-[0_16px_32px_-18px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)]',
                'transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-[#24252B] active:translate-y-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
              )}
            >
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-md bg-white/[0.06] transition-colors group-hover:bg-white/[0.1]">
                <CategoryGlyph src={card.icon} className="h-[18px] w-[18px]" />
              </span>
              {card.name}
              {card.count > 0 && (
                <span className="text-[12.5px] font-medium tabular-nums text-text-tertiary">{card.count.toLocaleString('en-US')}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * The sell band: a little taller than a card, the seller application's own
 * art behind it (blurred, low opacity), one line of copy and one button.
 */
function SellCta({ gameSlug, gameName }: { gameSlug: string; gameName: string }) {
  return (
    <section aria-labelledby="hub-sell" className="relative isolate mt-14 overflow-hidden rounded-xl bg-[#18191D] sm:mt-16">
      {/* eslint-disable-next-line @next/next/no-img-element -- static 18 KB backdrop, decorative */}
      <img
        src="/assets/heroes/sell-cta.avif"
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full scale-110 object-cover opacity-[0.4] blur-[4px]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(90deg, rgba(24,25,29,0.95) 0%, rgba(24,25,29,0.78) 45%, rgba(24,25,29,0.35) 100%), radial-gradient(60% 120% at 85% 50%, rgba(245,196,81,0.12), transparent 70%)',
        }}
      />
      <div className="flex min-h-[200px] flex-col justify-center gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <span aria-hidden className="hidden h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-text-primary sm:grid">
            <StorefrontIcon size={26} weight="duotone" />
          </span>
          <div className="min-w-0">
            <h2 id="hub-sell" className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-text-primary sm:text-[28px]">
              Start Making Money Today
            </h2>
            <p className="mt-1.5 max-w-xl text-[14.5px] leading-relaxed text-text-secondary">
              Sell your {gameName} items, accounts and currency, and make your first sale within hours.
            </p>
          </div>
        </div>
        <Link
          href={`/${gameSlug}/sell`}
          className="group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-6 text-[15px] font-semibold text-black transition-[background-color,transform] hover:bg-white/90 active:scale-[0.98]"
        >
          Start Selling
          <ArrowRightIcon size={16} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  )
}

function OpeningSoon({ gameSlug, gameName }: { gameSlug: string; gameName: string }) {
  return (
    <section className={cn('mt-8 rounded-xl px-6 py-12 text-center', CARD)}>
      <p className="text-[17px] font-semibold text-text-primary">{gameName} Is Opening Soon</p>
      <p className="mx-auto mt-2 max-w-xl text-[14px] text-text-secondary">
        No one has listed {gameName} yet. Sellers can start here first.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/${gameSlug}/sell`}
          className="inline-flex h-11 items-center justify-center rounded-md bg-white px-5 text-[14px] font-semibold text-black transition-colors hover:bg-white/90"
        >
          Sell {gameName}
        </Link>
        <Link
          href={`mailto:support@dropmarket.gg?subject=${encodeURIComponent(`Category request: ${gameName}`)}`}
          className="inline-flex h-11 items-center justify-center rounded-md bg-white/[0.07] px-5 text-[14px] font-semibold text-text-primary transition-colors hover:bg-white/[0.11]"
        >
          Request a Category
        </Link>
      </div>
    </section>
  )
}

export interface GameHubProps {
  gameSlug: string
  gameName: string
  gameImageUrl: string | null
  pitch: string
  spotlight: HubCard | null
  currencyIconUrl: string | null
  /** "r,g,b" accent of the currency icon (getImageAccent), or null. */
  currencyAccent: string | null
  grid: HubCard[]
  itemOffers: ItemOffer[]
  accountOffers: ItemOffer[]
  /** Items / accounts category pages, for the rows' See All. */
  itemsHref: string | null
  accountsHref: string | null
  totalOffers: number
  /** Cheapest live offer across the game ("$0.99"), for Why Buy. */
  fromPrice: string | null
  faq: { q: string; a: string }[]
  /** Server-rendered blog rail (BlogRail), or null. */
  blogRail: ReactNode
}

export function GameHub({
  gameSlug,
  gameName,
  gameImageUrl,
  pitch,
  spotlight,
  currencyIconUrl,
  currencyAccent,
  grid,
  itemOffers,
  accountOffers,
  itemsHref,
  accountsHref,
  totalOffers,
  fromPrice,
  faq,
  blogRail,
}: GameHubProps) {
  const hasCategories = !!spotlight || grid.length > 0
  return (
    <main className="min-h-screen pb-12">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <HubHeader gameName={gameName} gameImageUrl={gameImageUrl} pitch={pitch} totalOffers={totalOffers} />

        {!hasCategories && <OpeningSoon gameSlug={gameSlug} gameName={gameName} />}

        {spotlight && (
          <CurrencyBuyCard
            className={cn('mt-8', RISE, '[animation-delay:80ms]')}
            gameName={gameName}
            name={spotlight.name}
            href={spotlight.href}
            iconUrl={currencyIconUrl || (spotlight.icon.startsWith('/icons/categories/') ? null : spotlight.icon)}
            accent={currencyAccent}
            fromLabel={spotlight.fromLabel}
            count={spotlight.count}
            avgDelivery={spotlight.avgDelivery}
          />
        )}

        {itemsHref && (
          <OfferRail
            title="Top Selling Items"
            seeAllHref={itemsHref}
            offers={itemOffers}
            gameSlug={gameSlug}
            gameName={gameName}
          />
        )}
        {accountsHref && (
          <OfferRail
            title="Top Selling Accounts"
            seeAllHref={accountsHref}
            offers={accountOffers}
            gameSlug={gameSlug}
            gameName={gameName}
          />
        )}

        {hasCategories && <CategoryButtons cards={[...(spotlight ? [spotlight] : []), ...grid]} gameName={gameName} />}

        {hasCategories && <SellCta gameSlug={gameSlug} gameName={gameName} />}
      </div>

      <HowItWorksBand
        title={`How to Buy ${gameName} Items on DropMarket`}
        highlight={hubHighlight({ spotlight, currencyIconUrl, gameImageUrl, gameName, totalOffers })}
      />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <FaqSection
          title={`${gameName} FAQ`}
          sub={`What players ask before buying ${spotlight ? spotlight.name : `${gameName} items`}.`}
          items={faq}
        />

        <WhyBuyCard
          className="mt-14 sm:mt-16"
          gameSlug={gameSlug}
          subject={gameName}
          count={totalOffers}
          fromPrice={fromPrice}
        />

        {blogRail}
      </div>

      <PaymentsMarquee />
    </main>
  )
}
