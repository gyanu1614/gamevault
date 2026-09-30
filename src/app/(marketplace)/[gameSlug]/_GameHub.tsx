/**
 * The game hub: /fortnite, /roblox, … (every game but Steal a Brainrot, which
 * keeps its values landing). Owner, 2026-09-30: keep /{game} as the landing
 * page and rebuild it properly (it ranks for the broad "{game} marketplace"
 * searches; every category page's breadcrumb points here).
 *
 *   Header      game logo + name + one-line pitch + three facts
 *   Buy card    the game's currency (V-Bucks, Robux) with its live from-price
 *   Categories  one card per category: live offer count + from-price
 *   Offer rows  best item offers, best account offers (cheapest first)
 *   Sell        a quiet prompt to list this game
 *   How it works, About (the SEO intro), FAQ, blog, payments
 *
 * Server component: every link is in the HTML. Entrance motion is CSS-only
 * (visible without JavaScript, off under reduced motion). Fill-only cards on
 * the marketplace card gradient; green only on the Buy button.
 */

import Link from 'next/link'
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
import HowItWorksBand from '@/components/marketplace/HowItWorksBand'
import { SectionHeading } from '@/components/marketplace/SectionHeading'
import { FaqCards } from '@/components/marketplace/FaqCards'
import { PaymentsMarquee } from '@/components/marketplace/PaymentsMarquee'
import { OfferRail } from '@/components/marketplace/OfferRail'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'
import { cn } from '@/lib/utils'
import type { HubCard } from './_hubModel'
import type { ItemOffer } from './[categorySlug]/_itemsTypes'

const CARD =
  'bg-[linear-gradient(180deg,#212228_0%,#1A1B1F_100%)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]'
const CARD_HOVER = 'transition-[background-image,transform] duration-200 hover:bg-[linear-gradient(180deg,#27282F_0%,#1E1F25_100%)]'
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
  return <img src={src} alt="" aria-hidden className={cn('object-contain', className)} />
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

function CurrencySpotlight({ card, gameName, iconUrl }: { card: HubCard; gameName: string; iconUrl: string | null }) {
  const icon = iconUrl || card.icon
  return (
    <section
      aria-labelledby="hub-currency"
      className={cn('mt-8 overflow-hidden rounded-xl', CARD, RISE, '[animation-delay:80ms]')}
    >
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white/[0.05]">
            <CategoryGlyph src={icon} className="h-10 w-10" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-text-tertiary">{gameName} Currency</p>
            <h2 id="hub-currency" className="mt-0.5 text-[22px] font-bold leading-tight tracking-[-0.01em] text-text-primary">
              Buy {card.name}
            </h2>
            <p className="mt-1 text-[13.5px] text-text-secondary">
              {card.fromLabel ? (
                <>
                  From <span className="font-semibold tabular-nums text-text-primary">{card.fromLabel}</span>
                  <span aria-hidden className="mx-1.5 text-text-tertiary">·</span>
                  {card.count.toLocaleString('en-US')} {card.count === 1 ? 'Offer' : 'Offers'}
                  {card.avgDelivery && (
                    <>
                      <span aria-hidden className="mx-1.5 text-text-tertiary">·</span>
                      Delivered in about {card.avgDelivery}
                    </>
                  )}
                </>
              ) : (
                'Offers are opening soon.'
              )}
            </p>
          </div>
        </div>
        <Link href={card.href} className="group shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
          <BuyButtonFace size="lg" className="w-full sm:w-auto sm:min-w-[180px]">
            Buy {card.name}
          </BuyButtonFace>
        </Link>
      </div>
    </section>
  )
}

function CategoryCard({ card, index }: { card: HubCard; index: number }) {
  return (
    <li className={RISE} style={{ animationDelay: `${120 + index * 50}ms` }}>
      <Link
        href={card.href}
        className={cn(
          'group flex h-full min-h-[136px] flex-col justify-between rounded-lg p-4 sm:p-5',
          CARD,
          CARD_HOVER,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-white/[0.05] transition-colors group-hover:bg-white/[0.08]">
            <CategoryGlyph src={card.icon} className="h-6 w-6" />
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.04] text-text-tertiary transition-[background-color,color,transform] duration-200 group-hover:bg-white/[0.09] group-hover:text-text-primary">
            <ArrowUpRightIcon
              size={14}
              weight="bold"
              aria-hidden
              className="transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px"
            />
          </span>
        </div>
        <div className="mt-4 min-w-0">
          <h3 className="truncate text-[16px] font-semibold text-text-primary">{card.name}</h3>
          {/* Two fixed lines (count, then price) so a narrow phone card
              never breaks "From $12.99" across lines. */}
          <p className="mt-1 text-[13px] leading-snug text-text-secondary">
            {card.count > 0 ? (
              <>
                <span className="block tabular-nums">
                  {card.count.toLocaleString('en-US')} {card.count === 1 ? 'Offer' : 'Offers'}
                </span>
                {card.fromLabel && (
                  <span className="block whitespace-nowrap">
                    From <span className="font-semibold tabular-nums text-text-primary">{card.fromLabel}</span>
                  </span>
                )}
              </>
            ) : (
              <span className="block text-text-tertiary">No offers yet</span>
            )}
          </p>
        </div>
      </Link>
    </li>
  )
}

function SellPrompt({ gameSlug, gameName }: { gameSlug: string; gameName: string }) {
  return (
    <section
      aria-labelledby="hub-sell"
      className={cn('mt-12 flex flex-col gap-5 rounded-xl p-5 sm:mt-14 sm:flex-row sm:items-center sm:justify-between sm:p-7', CARD)}
    >
      <div className="flex min-w-0 items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-text-secondary">
          <StorefrontIcon size={22} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="hub-sell" className="text-[18px] font-bold leading-tight text-text-primary">
            Sell {gameName} on DropMarket
          </h2>
          <p className="mt-1 text-[13.5px] text-text-secondary">
            List your {gameName} items, accounts or currency in minutes.
          </p>
        </div>
      </div>
      <Link
        href={`/${gameSlug}/sell`}
        className="group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-5 text-[14px] font-semibold text-black transition-[background-color,transform] hover:bg-white/90 active:scale-[0.98]"
      >
        Start Selling
        <ArrowRightIcon size={15} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
      </Link>
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
  grid: HubCard[]
  itemOffers: ItemOffer[]
  accountOffers: ItemOffer[]
  /** Items / accounts category pages, for the rows' See All. */
  itemsHref: string | null
  accountsHref: string | null
  totalOffers: number
  about: { title: string; body: string }
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
  grid,
  itemOffers,
  accountOffers,
  itemsHref,
  accountsHref,
  totalOffers,
  about,
  faq,
  blogRail,
}: GameHubProps) {
  const hasCategories = !!spotlight || grid.length > 0
  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <HubHeader gameName={gameName} gameImageUrl={gameImageUrl} pitch={pitch} totalOffers={totalOffers} />

        {!hasCategories && <OpeningSoon gameSlug={gameSlug} gameName={gameName} />}

        {spotlight && <CurrencySpotlight card={spotlight} gameName={gameName} iconUrl={currencyIconUrl} />}

        {grid.length > 0 && (
          <section aria-labelledby="hub-categories" className="mt-10 sm:mt-12">
            <h2 id="hub-categories" className="mb-5 text-[20px] font-bold tracking-[-0.01em] text-text-primary sm:text-[24px]">
              Shop by Category
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {grid.map((card, i) => (
                <CategoryCard key={card.id} card={card} index={i} />
              ))}
            </ul>
          </section>
        )}

        {itemsHref && (
          <OfferRail
            title="Best Item Offers"
            seeAllHref={itemsHref}
            offers={itemOffers}
            gameSlug={gameSlug}
            gameName={gameName}
          />
        )}
        {accountsHref && (
          <OfferRail
            title="Best Account Offers"
            seeAllHref={accountsHref}
            offers={accountOffers}
            gameSlug={gameSlug}
            gameName={gameName}
          />
        )}

        {hasCategories && <SellPrompt gameSlug={gameSlug} gameName={gameName} />}
      </div>

      <HowItWorksBand />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* About — the SEO intro, as readable copy (it used to be the hero
            paragraph). */}
        <section aria-labelledby="hub-about" className="mx-auto mt-10 max-w-3xl sm:mt-14">
          <h2 id="hub-about" className="text-[20px] font-bold tracking-[-0.01em] text-text-primary sm:text-[24px]">
            {about.title}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{about.body}</p>
          {(itemsHref || accountsHref || spotlight) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {[spotlight, ...grid].filter(Boolean).map((c) => (
                <Link
                  key={c!.id}
                  href={c!.href}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/[0.05] px-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-white/[0.09] hover:text-text-primary"
                >
                  {gameName} {c!.name}
                </Link>
              ))}
            </div>
          )}
        </section>

        {faq.length > 0 && (
          <section className="mt-12 sm:mt-16">
            <SectionHeading
              kicker="FAQ"
              title="Frequently Asked"
              accent="Questions"
              sub={`Everything you need to know about buying ${gameName} on DropMarket.`}
            />
            <FaqCards items={faq} />
          </section>
        )}

        {blogRail}
      </div>

      <PaymentsMarquee />
    </main>
  )
}
