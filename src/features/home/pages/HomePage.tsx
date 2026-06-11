'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Tag,
  Lock,
  Package,
  CheckCircle2,
  ShieldCheck,
  Coins,
  Headset,
  LayoutGrid,
  Wallet,
} from 'lucide-react'

import { HeroCarousel } from '../components/HeroCarousel'
import { RowHeader } from '../components/RowHeader'
import { HorizontalScroller } from '../components/HorizontalScroller'
import { GameCard } from '../components/GameCard'
import { CurrencyCard } from '../components/CurrencyCard'
import { CategoryCard } from '../components/CategoryCard'
import { StatTile } from '../components/StatTile'
import { HowStep } from '../components/HowStep'
import { WhyCard } from '../components/WhyCard'
import { RecentlySoldTicker } from '../components/RecentlySoldTicker'

import { useHeroSlides } from '../hooks/useHeroSlides'
import { usePopularGames } from '../hooks/usePopularGames'
import { usePopularCurrencies } from '../hooks/usePopularCurrencies'
import { usePopularItems, usePopularAccounts, usePopularTopups } from '../hooks/usePopularCategories'
import { useRecentSales } from '../hooks/useRecentSales'

const HOW_IT_WORKS_STEPS = [
  {
    num: '01',
    icon: Tag,
    title: 'Find your listing',
    body: 'Browse verified sellers and lock in the lowest price across 180+ games.',
  },
  {
    num: '02',
    icon: Lock,
    title: 'Pay into escrow',
    body: "VaultShield holds your money. The seller can see the order but can't touch a cent.",
  },
  {
    num: '03',
    icon: Package,
    title: 'Receive your goods',
    body: 'Get instant auto-delivery, or chat with the seller for a manual handover.',
  },
  {
    num: '04',
    icon: CheckCircle2,
    title: 'Confirm & release',
    body: 'Happy? Confirm delivery and funds release. A problem? Open a dispute, we step in.',
  },
] as const

const WHY_CARDS = [
  {
    icon: Lock,
    title: 'Escrow on every order',
    body: 'Your money is held by VaultShield until you confirm you got exactly what you paid for. Disputes are reviewed by real humans.',
    badge: '$0 lost to scams',
  },
  {
    icon: ShieldCheck,
    title: 'Only verified sellers',
    body: 'ID + payment verification, trade history and a public rating on every seller. The sketchy ones never make it in.',
    badge: '98.7% delivery rate',
  },
  {
    icon: Coins,
    title: "Fees that aren't a rip-off",
    body: 'Sellers pay 5–10% instead of the 17–26% competitors charge — which means better prices for you, every time.',
    badge: '5–10% seller fee',
  },
  {
    icon: Headset,
    title: '24/7 dispute support',
    body: 'Stuck mid-trade? Our support team and dispute resolution are online around the clock, every day of the year.',
    badge: 'Avg reply · 4 min',
  },
] as const

/**
 * Popular Games shelf — 10 games in a horizontal scroller, 6 visible per page,
 * arrow buttons page through. Cards always sized to ~1/6th of the panel width.
 */
function PopularGamesShelf({ games }: { games: ReturnType<typeof usePopularGames>['data'] }) {
  const list = games ?? []
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const onScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 4)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }

  const page = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    // Page by ~5 card-widths so a couple of cards overlap (no abrupt jump)
    const cardWidth = el.clientWidth / 6
    el.scrollBy({ left: dir * cardWidth * 5, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="grid grid-flow-col auto-cols-[calc((100%-1.25rem*5)/6)] gap-5 overflow-x-auto scrollbar-hide scroll-smooth"
        style={{ scrollbarWidth: 'none' }}
      >
        {list.map((game) => (
          <div key={game.slug}>
            <GameCard
              slug={game.slug}
              name={game.name}
              coverSrc={game.coverSrc}
            />
          </div>
        ))}
      </div>

      {/* Prev arrow */}
      <button
        type="button"
        onClick={() => page(-1)}
        aria-label="Previous games"
        disabled={atStart}
        className="absolute left-0 top-[40%] -translate-y-1/2 -translate-x-1/2 w-11 h-11 rounded-full bg-bg-base/90 backdrop-blur-md border border-border-default shadow-elevated grid place-items-center text-text-primary hover:bg-bg-raised hover:border-border-strong disabled:opacity-0 disabled:pointer-events-none transition-all duration-fast ease-gv z-10"
      >
        <ChevronLeft aria-hidden="true" className="w-5 h-5" />
      </button>

      {/* Next arrow */}
      <button
        type="button"
        onClick={() => page(1)}
        aria-label="More games"
        disabled={atEnd}
        className="absolute right-0 top-[40%] -translate-y-1/2 translate-x-1/2 w-11 h-11 rounded-full bg-bg-base/90 backdrop-blur-md border border-border-default shadow-elevated grid place-items-center text-text-primary hover:bg-bg-raised hover:border-border-strong disabled:opacity-0 disabled:pointer-events-none transition-all duration-fast ease-gv z-10"
      >
        <ChevronRight aria-hidden="true" className="w-5 h-5" />
      </button>
    </div>
  )
}

/**
 * Shop-by-category tabbed shelf — Currencies | Items | Accounts in one panel.
 * 5-column grid; default shows 2 rows (10 cards); "Show more" expands to 4 rows (20 cards).
 */
type ShopTab = 'currencies' | 'items' | 'accounts'

const ROWS_COLLAPSED = 2
const ROWS_EXPANDED = 4
const COLUMNS = 5

function ShopByCategoryShelf({
  currencies,
  items,
  accounts,
}: {
  currencies: ReturnType<typeof usePopularCurrencies>['data']
  items: ReturnType<typeof usePopularItems>['data']
  accounts: ReturnType<typeof usePopularAccounts>['data']
}) {
  const [tab, setTab] = useState<ShopTab>('currencies')
  const [expanded, setExpanded] = useState(false)

  const onTabChange = (next: ShopTab) => {
    setTab(next)
    setExpanded(false) // collapse when switching tabs so users see the top picks first
  }

  const TABS: { id: ShopTab; label: string }[] = [
    { id: 'currencies', label: 'Currencies' },
    { id: 'items',      label: 'Items' },
    { id: 'accounts',   label: 'Accounts' },
  ]

  const visibleCount = (expanded ? ROWS_EXPANDED : ROWS_COLLAPSED) * COLUMNS

  const renderCards = () => {
    if (tab === 'currencies') {
      return (currencies ?? []).slice(0, visibleCount).map((c) => (
        <CurrencyCard key={c.slug} {...c} />
      ))
    }
    if (tab === 'items') {
      return (items ?? []).slice(0, visibleCount).map((i) => (
        <CategoryCard key={i.href} {...i} />
      ))
    }
    return (accounts ?? []).slice(0, visibleCount).map((a) => (
      <CategoryCard key={a.href} {...a} />
    ))
  }

  // Decide if "Show more" button should appear (only when there's more to reveal)
  const totalForTab = tab === 'currencies' ? (currencies?.length ?? 0)
    : tab === 'items'      ? (items?.length ?? 0)
    :                        (accounts?.length ?? 0)
  const hasMore = totalForTab > ROWS_COLLAPSED * COLUMNS

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={
                active
                  ? 'inline-flex items-center h-10 px-5 rounded-full bg-lime text-text-inverse font-semibold text-body-sm transition-all duration-fast ease-gv'
                  : 'inline-flex items-center h-10 px-5 rounded-full bg-bg-raised border border-border-default text-text-secondary font-semibold text-body-sm hover:border-border-strong hover:text-text-primary transition-all duration-fast ease-gv'
              }
              aria-pressed={active}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Grid — 5 columns × 2 or 4 rows */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
        {renderCards()}
      </div>

      {/* Show more / less toggle */}
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-bg-raised border border-border-default text-text-secondary font-semibold text-body-sm hover:border-border-strong hover:text-text-primary transition-all duration-fast ease-gv"
          >
            {expanded ? (
              <>
                Show less
                <ChevronUp aria-hidden="true" className="w-4 h-4" />
              </>
            ) : (
              <>
                Show more
                <ChevronDown aria-hidden="true" className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export function HomePage() {
  const { data: heroSlides = [] } = useHeroSlides()
  const { data: popularGames = [] } = usePopularGames()
  const { data: popularCurrencies = [] } = usePopularCurrencies()
  const { data: popularItems = [] } = usePopularItems()
  const { data: popularAccounts = [] } = usePopularAccounts()
  const { data: popularTopups = [] } = usePopularTopups()
  const { data: recentSales = [] } = useRecentSales()

  return (
    <main className="relative">
      {/* ================================================================
          GLOBAL NOISE TEXTURE — sits above background, below content.
          Fixed so it doesn't scroll. Very low opacity = "alive" not "noisy".
          ================================================================ */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: "url('/textures/noise.svg')",
          backgroundRepeat: 'repeat',
          backgroundSize: '240px 240px',
        }}
      />

      {/* ================================================================
          HERO — headline + full-width carousel
          Fits viewport height (100vh - nav). No scroll needed.
          ================================================================ */}
      <section className="relative flex flex-col h-[calc(100vh-68px)] py-5 overflow-hidden">
        {/* Faint lime wash — NOT an orb */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 -translate-x-1/2 w-[72%] h-[64%] pointer-events-none z-0"
          style={{ background: 'radial-gradient(ellipse at center top, rgba(198,255,61,0.06), transparent 64%)' }}
        />

        {/* Headline — vertically centered in the space above the carousel */}
        <div className="mx-auto text-center flex flex-col items-center justify-center relative z-10 flex-[1.5_1_0%] min-h-0 px-6">
          <h1 className="font-display text-heading md:text-display lg:text-display-lg whitespace-nowrap">
            <span
              className="block p-[5px] bg-clip-text text-transparent bg-[length:400%_auto] animate-gradient-x"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, #ffffff 0%, #ffffff 35%, var(--color-accent-default) 50%, #ffffff 65%, #ffffff 100%)',
              }}
            >
              Game More. Grind Less.
            </span>
          </h1>
        </div>

        {/* DYNAMIC: hero carousel — admin-editable 3 games */}
        <div className="flex-[4_1_0%] min-h-0 flex flex-col px-6">
          <HeroCarousel slides={heroSlides} />
        </div>
      </section>

      {/* ================================================================
          POPULAR GAMES — portrait cover-art cards on backdrop
          DYNAMIC: popular games row — from /api/popular/games
          ================================================================ */}
      <section className="relative py-20 overflow-hidden">
        {/* ASSET: cinematic backdrop — 2400×900 JPG, drop replacement at same path */}
        <Image
          src="/section-bg/popular-games.jpg"
          alt=""
          fill
          aria-hidden="true"
          className="object-cover blur-md saturate-[0.65] scale-105 z-0"
          sizes="100vw"
          priority={false}
        />
        {/* Dark overlay — readability */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,10,15,0.90) 0%, rgba(10,10,15,0.72) 50%, rgba(10,10,15,0.94) 100%)',
          }}
        />
        {/* Vignette */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 35%, rgba(10,10,15,0.55) 100%)',
          }}
        />
        <div className="max-w-container mx-auto px-6 relative z-10">
          <RowHeader title="Popular Games" viewAllHref="/games" />
          {/* Single rounded glass panel containing the 10-game shelf with arrow paging */}
          <div
            className="rounded-3xl border border-border-default bg-bg-raised/70 backdrop-blur-md shadow-elevated p-6 md:p-8"
            style={{
              background:
                'linear-gradient(180deg, rgba(20,20,28,0.78) 0%, rgba(14,14,20,0.85) 100%)',
            }}
          >
            <PopularGamesShelf games={popularGames} />
          </div>
        </div>
      </section>

      {/* ================================================================
          TRUST STATS — animated count-up on scroll
          ================================================================ */}
      <section className="relative border-y border-border-subtle bg-bg-raised overflow-hidden">
        {/* Soft lime sweep behind stats */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(60% 120% at 20% 50%, rgba(198,255,61,0.08), transparent 60%), radial-gradient(60% 120% at 80% 50%, rgba(120,180,255,0.05), transparent 60%)',
          }}
        />
        <div className="relative z-10 max-w-container mx-auto px-6 grid grid-cols-2 lg:grid-cols-4">
          <StatTile
            value={1_240_000}
            suffix="+"
            compact
            accent
            label="Orders delivered"
            className="border-r border-border-subtle"
          />
          <StatTile
            value={48}
            prefix="$"
            suffix="M+"
            label="Traded securely"
            className="lg:border-r border-border-subtle"
          />
          <StatTile
            value={4.9}
            decimals={1}
            label="Avg seller rating"
            className="border-r border-border-subtle border-t lg:border-t-0"
          />
          <StatTile
            value={180}
            suffix="+"
            label="Games supported"
            className="border-t lg:border-t-0"
          />
        </div>
      </section>

      {/* ================================================================
          HOW IT WORKS — 4-step escrow explainer
          ================================================================ */}
      <section className="relative py-20 overflow-hidden">
        {/* ASSET: cinematic backdrop — 2400×900 JPG, drop replacement at same path */}
        <Image
          src="/section-bg/how-it-works.jpg"
          alt=""
          fill
          aria-hidden="true"
          className="object-cover blur-md saturate-[0.7] scale-105 z-0"
          sizes="100vw"
          priority={false}
        />
        {/* Dark overlay — readability */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,10,15,0.92) 0%, rgba(10,10,15,0.78) 50%, rgba(10,10,15,0.95) 100%)',
          }}
        />
        {/* Vignette — fade edges back to bg-base */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 40%, rgba(10,10,15,0.6) 100%)',
          }}
        />
        <div className="max-w-container mx-auto px-6 relative z-10">
          <div className="flex justify-between items-end gap-8 mb-12 flex-wrap">
            <div>
              <span className="text-overline uppercase text-white text-[15px]">How it works</span>
              <h2 className="font-display text-display mt-[10px]">Safe in four steps.</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS_STEPS.map((step, index) => (
              <HowStep
                key={step.num}
                {...step}
                showConnector={index < HOW_IT_WORKS_STEPS.length - 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          SHOP BY CATEGORY — tabbed: Currencies / Items / Accounts
          Replaces three separate sections with one consolidated shelf.
          ================================================================ */}
      <section className="py-20">
        <div className="max-w-container mx-auto px-6 relative z-10">
          <div className="flex justify-between items-end gap-8 mb-6 flex-wrap">
            <div>
              <span className="text-overline uppercase text-white text-[15px]">Marketplace</span>
              <h2 className="font-display text-display mt-[10px]">Shop by category.</h2>
            </div>
          </div>
          <div
            className="rounded-3xl border border-border-default bg-bg-raised/70 backdrop-blur-md shadow-elevated p-6 md:p-8"
            style={{
              background:
                'linear-gradient(180deg, rgba(20,20,28,0.78) 0%, rgba(14,14,20,0.85) 100%)',
            }}
          >
            <ShopByCategoryShelf
              currencies={popularCurrencies}
              items={popularItems}
              accounts={popularAccounts}
            />
          </div>
        </div>
      </section>

      {/* ================================================================
          TOP-UPS & GIFT CARDS
          DYNAMIC: popular top-ups — from /api/popular/topups
          ================================================================ */}
      <section className="py-20 bg-bg-raised border-y border-border-subtle">
        <div className="max-w-container mx-auto px-6 relative z-10">
          <RowHeader title="Top-Ups & Gift Cards" viewAllHref="/topups" />
          <HorizontalScroller>
            {popularTopups.map((topup) => (
              <CurrencyCard key={topup.slug} {...topup} hrefBase="/topup" />
            ))}
          </HorizontalScroller>
        </div>
      </section>

      {/* ================================================================
          WHY CHOOSE GAMEVAULT — 4 trust/safety cards
          ================================================================ */}
      <section className="relative py-20 overflow-hidden">
        {/* Aurora blobs — slow drifting lime + cool-blue wash */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-1/4 -left-1/4 w-[60%] h-[120%] z-0 blur-3xl opacity-60 animate-aurora-drift-a"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(198,255,61,0.18), transparent 60%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-1/4 -right-1/4 w-[55%] h-[110%] z-0 blur-3xl opacity-60 animate-aurora-drift-b"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(100,160,255,0.14), transparent 60%)',
          }}
        />
        <div className="max-w-container mx-auto px-6 relative z-10">
          <div className="flex justify-between items-end gap-8 mb-12 flex-wrap">
            <div>
              <span className="text-overline uppercase text-white">Why Choose GameVault</span>
              <h2 className="font-display text-display mt-[10px]">Built so you can&apos;t get burned.</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {WHY_CARDS.map((card) => (
              <WhyCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          LIVE RECENTLY-SOLD TICKER
          DYNAMIC: from /api/recent-sales, WebSocket for real-time updates
          ================================================================ */}
      <section className="py-12 border-t border-border-subtle">
        <div className="max-w-container mx-auto px-6 flex items-center justify-between mb-5 gap-3">
          <span className="inline-flex items-center gap-[9px] font-body font-semibold text-body-sm">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse-success" aria-hidden="true" />
            Live · just sold
          </span>
          <span className="text-body-sm text-text-tertiary">Updated in real time across every game</span>
        </div>
        <RecentlySoldTicker items={recentSales} />
      </section>

      {/* ================================================================
          CTA BAND
          ================================================================ */}
      <section className="py-20">
        <div className="max-w-container mx-auto px-6 relative z-10">
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10 p-12 rounded-xl border border-border-default bg-bg-raised overflow-hidden">
            {/* ASSET: cinematic backdrop — 2400×900 JPG, drop replacement at same path */}
            <Image
              src="/section-bg/cta-band.jpg"
              alt=""
              fill
              aria-hidden="true"
              className="object-cover saturate-[0.8] z-0"
              sizes="(max-width: 1280px) 100vw, 1280px"
              priority={false}
            />
            {/* Dark overlay */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                background:
                  'linear-gradient(90deg, rgba(10,10,15,0.92) 0%, rgba(10,10,15,0.75) 60%, rgba(10,10,15,0.85) 100%)',
              }}
            />
            {/* Lime tint kept on top for brand wash */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                background:
                  'radial-gradient(120% 140% at 0% 0%, rgba(198,255,61,0.10), transparent 50%)',
              }}
            />
            <div className="relative z-10">
              <h2 className="font-display text-display max-w-[18ch]">
                Start trading with the lowest fees in the game.
              </h2>
              <p className="text-body-lg text-text-secondary max-w-[46ch] mt-[14px]">
                Join 1.2M gamers buying and selling under VaultShield protection.
              </p>
            </div>
            <div className="relative z-10 flex flex-col gap-3 w-full lg:w-auto">
              <Link
                href="/browse"
                className="inline-flex items-center justify-center gap-2 h-[54px] px-8 bg-lime text-text-inverse font-semibold text-[17px] rounded-lg hover:bg-lime-hover hover:shadow-glow active:bg-lime-pressed transition-all duration-fast ease-gv"
              >
                <LayoutGrid aria-hidden="true" className="w-5 h-5" />
                Browse marketplace
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 h-[54px] px-8 bg-transparent text-text-primary font-semibold text-[17px] rounded-lg border border-border-strong hover:bg-state-hover hover:border-text-tertiary transition-all duration-fast ease-gv"
              >
                <Wallet aria-hidden="true" className="w-5 h-5" />
                Create free account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
