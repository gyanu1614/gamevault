'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Tag,
  Package,
  CheckCircle2,
  ShieldCheck,
  Coins,
  Headset,
  LayoutGrid,
  User,
  Zap,
  Rocket,
  Gift,
  Swords,
} from 'lucide-react'

import { HeroCarousel } from '../components/HeroCarousel'
import { RowHeader } from '../components/RowHeader'
import { TopUpsBanner } from '../components/TopUpsBanner'
import { HorizontalScroller } from '../components/HorizontalScroller'
import { GameCard } from '../components/GameCard'
import { CurrencyCard } from '../components/CurrencyCard'
import { CategoryCard } from '../components/CategoryCard'
import { StatsMarquee } from '../components/StatsMarquee'
import { HowItWorks } from '../components/HowItWorks'
import { WhyCard } from '../components/WhyCard'
import { RecentlySoldTicker } from '../components/RecentlySoldTicker'

import { useHeroSlides } from '../hooks/useHeroSlides'
import { usePopularGames } from '../hooks/usePopularGames'
import { usePopularCurrencies } from '../hooks/usePopularCurrencies'
import { usePopularItems, usePopularAccounts, usePopularTopups } from '../hooks/usePopularCategories'
import { useRecentSales } from '../hooks/useRecentSales'


/** V57 — Pre-footer category strip (reference: category pills under the
 *  closing CTA). Icons stay lucide so the strip inherits theme colors. */
const CTA_CATEGORIES = [
  { label: 'Accounts', icon: User, href: '/browse' },
  { label: 'Currencies', icon: Coins, href: '/browse' },
  { label: 'Top Ups', icon: Zap, href: '/#top-ups' },
  { label: 'Items', icon: Swords, href: '/browse' },
  { label: 'Boosting', icon: Rocket, href: '/browse' },
  { label: 'Gift Cards', icon: Gift, href: '/#top-ups' },
] as const

const WHY_CARDS = [
  {
    icon: ShieldCheck,
    title: 'SafeDrop on Every Order',
    body: 'The seller is only paid after you confirm delivery. Not delivered or not as described? You get your money back — and real humans review anything off.',
    tone: 'lime',
    img: '/icons/trust/money-back.png',
  },
  {
    icon: ShieldCheck,
    title: 'Sellers earn their spot',
    body: 'ID checks, payment verification, live ratings and full trade history on every storefront. The sketchy ones never make it in.',
    tone: 'success',
    img: '/icons/safedrop-emblem.png',
  },
  {
    icon: Coins,
    title: "Fees that don't sting",
    body: 'Sellers pay 5–10% — not the 17–26% the big marketplaces skim — so listings start cheaper here and stay cheaper.',
    tone: 'warning',
    img: '/how-it-works/step-2.png',
  },
  {
    icon: Headset,
    title: 'Humans, around the clock',
    body: 'Stuck mid-trade at 4 AM? Support and dispute resolution never close — real people, around the clock.',
    tone: 'info',
    img: '/icons/trust/support.png',
  },
] as const

/**
 * Popular Games shelf — 10 games in a horizontal scroller, 6 visible per page,
 * arrow buttons page through. Cards always sized to ~1/6th of the panel width.
 */
function PopularGamesShelf({ games }: { games: ReturnType<typeof usePopularGames>['data'] }) {
  // V17t — Hooks declared first (React rules-of-hooks: no conditional
  // hook calls). The empty-list early return is BELOW so it doesn't
  // skip the hook calls on the loading frame.
  const list = games ?? []
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  // Loading state — skeleton tiles matching the real card geometry so
  // the section doesn't pop in.
  if (list.length === 0) {
    return (
      <div className="grid grid-flow-col auto-cols-[calc((100%-0.75rem)/2)] gap-3 overflow-hidden sm:auto-cols-[calc((100%-1.25rem*2)/3)] sm:gap-5 lg:auto-cols-[calc((100%-1.25rem*5)/6)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[4/5] w-full animate-pulse rounded-2xl bg-[rgba(28,28,37,0.6)] border border-border-subtle" />
            <div className="mt-3 px-1 h-5 w-24 animate-pulse rounded bg-[rgba(28,28,37,0.6)]" />
          </div>
        ))}
      </div>
    )
  }

  const onScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 4)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }

  const page = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    // Page by ~85% of the visible width so a card overlaps between
    // pages — works at every breakpoint (2/3/6 visible columns).
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="grid grid-flow-col auto-cols-[calc((100%-0.75rem)/2)] gap-3 overflow-x-auto scrollbar-hide scroll-smooth sm:auto-cols-[calc((100%-1.25rem*2)/3)] sm:gap-5 lg:auto-cols-[calc((100%-1.25rem*5)/6)]"
        style={{ scrollbarWidth: 'none' }}
      >
        {list.map((game) => (
          <div key={game.slug}>
            <GameCard
              slug={game.slug}
              name={game.name}
              coverSrc={game.coverSrc}
              href={game.href}
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
        className="absolute left-0 top-[40%] -translate-y-1/2 -translate-x-1/2 w-11 h-11 rounded-full bg-[rgba(10,10,15,0.9)] backdrop-blur-md border border-border-default shadow-elevated grid place-items-center text-text-primary hover:bg-bg-raised hover:border-border-strong disabled:opacity-0 disabled:pointer-events-none transition-all duration-fast ease-gv z-10"
      >
        <ChevronLeft aria-hidden="true" className="w-5 h-5" />
      </button>

      {/* Next arrow */}
      <button
        type="button"
        onClick={() => page(1)}
        aria-label="More games"
        disabled={atEnd}
        className="absolute right-0 top-[40%] -translate-y-1/2 translate-x-1/2 w-11 h-11 rounded-full bg-[rgba(10,10,15,0.9)] backdrop-blur-md border border-border-default shadow-elevated grid place-items-center text-text-primary hover:bg-bg-raised hover:border-border-strong disabled:opacity-0 disabled:pointer-events-none transition-all duration-fast ease-gv z-10"
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
    <div
      className="has-backdrop relative"
      style={{
        '--page-hero-image': "url('/assets/heroes/home.avif')",
        '--hero-offset': '80px',
      } as React.CSSProperties}
    >
      {/* V20 — Hero backdrop lives at the <main> level so the art
          extends UP behind the floating navbar (no black band between
          navbar pill and hero art). The .has-backdrop class makes
          this `relative`, and the .hero-backdrop div is pinned to the
          top of <main> spanning --hero-height. */}
      <div className="hero-backdrop" aria-hidden="true" />

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

      <section className="relative flex flex-col h-[calc(100svh-160px)] min-h-[480px] py-5 px-6 overflow-hidden">

        {/* Headline — vertically centered in the space above the carousel */}
        <div className="mx-auto text-center flex flex-col items-center justify-center relative z-10 flex-[1.5_1_0%] min-h-0">
          <h1 className="font-display text-[clamp(22px,7vw,28px)] md:text-display lg:text-display-lg md:whitespace-nowrap">
            <span
              className="block bg-clip-text text-transparent bg-[length:400%_auto] animate-gradient-x"
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
        <div className="flex-[4_1_0%] min-h-0 flex flex-col">
          <HeroCarousel slides={heroSlides} />
        </div>
      </section>

      {/* ================================================================
          POPULAR GAMES — portrait cover-art cards on backdrop
          DYNAMIC: popular games row — from /api/popular/games
          ================================================================ */}
      <section className="relative py-20">
        <div className="max-w-container mx-auto px-6">
          {/* V20/P13 — Centered, floating heading. Section bg + overlays
              removed so the body's ambient glows continue through. */}
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="mb-3 inline-flex items-center gap-2">
              <span className="h-px w-10 bg-gradient-to-l from-[#C6FF3D80] to-transparent" aria-hidden />
              <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
                Trending now
              </span>
              <span className="h-px w-10 bg-gradient-to-r from-[#C6FF3D80] to-transparent" aria-hidden />
            </div>
            <h2 className="font-display text-[32px] font-extrabold leading-[1.04] tracking-tight sm:text-[44px] lg:text-[56px]">
              Popular Games
            </h2>
            <p className="mt-4 max-w-2xl text-body-lg text-text-secondary">
              The games our buyers and sellers are most active in right now.
            </p>
          </div>
          <PopularGamesShelf games={popularGames} />
        </div>
      </section>

      {/* ================================================================
          TRUST STATS — V20/P15 horizontal scrolling marquee of stat chips
          No bg, edge-fades, pauses on hover. Hero art continues through.
          ================================================================ */}
      <section className="relative py-10">
        <StatsMarquee />
      </section>

      {/* ================================================================
          HOW IT WORKS
          ================================================================ */}
      {/* V20/P16 — Apple-style scroll-pinned How It Works. Sticky stage
          on the right cross-fades through 4 hero illustrations as the
          copy column on the left scrolls past 4 stages. */}
      <HowItWorks />

      {/* ================================================================
          SHOP BY CATEGORY — tabbed: Currencies / Items / Accounts
          Replaces three separate sections with one consolidated shelf.
          ================================================================ */}
      <section className="relative py-20 overflow-hidden">
        {/* V17i — Subtle backdrop wash matching the other backdrop'd
            sections. Faint lime+steel radial pair so this section isn't
            visually flat next to Popular Games. No image asset needed. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(80% 60% at 15% 20%, rgba(198,255,61,0.05), transparent 55%),' +
              'radial-gradient(70% 50% at 85% 85%, rgba(120,168,255,0.04), transparent 60%)',
          }}
        />
        {/* V58 — Roblox crew as a full-width backdrop band: the lineup
            stands across the top of the section BEHIND the heading and
            fades out on the way down (and at the side edges), so it
            reads as scene-setting, not decoration. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/characters/roblox-crew.webp"
          alt=""
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 z-0 hidden w-[1240px] max-w-none -translate-x-1/2 select-none object-contain opacity-[0.26] [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_38%,transparent_88%)] md:block"
        />
        <div className="max-w-container mx-auto px-6 relative z-10">
          <div className="mb-6">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
                Marketplace
              </span>
              <span className="h-px w-8 bg-gradient-to-r from-[#C6FF3D66] to-transparent" aria-hidden />
            </div>
            <h2 className="font-display text-display">Shop by category.</h2>
            <p className="mt-1.5 text-body-sm text-text-secondary max-w-2xl">
              Currencies, items, accounts — pick how you want to play and we&apos;ll show you the matching deals.
            </p>
          </div>
          <ShopByCategoryShelf
            currencies={popularCurrencies}
            items={popularItems}
            accounts={popularAccounts}
          />
        </div>
      </section>

      {/* ================================================================
          TOP-UPS & GIFT CARDS
          DYNAMIC: popular top-ups — from /api/popular/topups
          ================================================================ */}
      {/* V17m — Section gets the chibi-mascot banner backdrop per the
          design handoff. Image is layered behind via TopUpsBanner; the
          content stack lives at z-10 and uses the center ~60% of the
          width so it sits on the dark negative-space strip. */}
      <section id="top-ups" className="relative py-20 border-y border-border-subtle overflow-hidden">
        <TopUpsBanner />
        <div className="max-w-container mx-auto px-6 relative z-10">
          <RowHeader
            eyebrow="Direct top-ups"
            title="Top-Ups & Gift Cards"
            subtitle="Official codes and direct top-ups — delivered the same way you'd buy them at retail."
            viewAllHref="/topups"
          />
          <HorizontalScroller>
            {popularTopups.map((topup) => (
              <CurrencyCard key={topup.slug} {...topup} />
            ))}
          </HorizontalScroller>
        </div>
      </section>

      {/* ================================================================
          WHY CHOOSE DROPMARKET — 4 trust/safety cards
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
        {/* V17p — Narrower max-width + centered intro to match the
            "How it works" trust section. Creates rhythm by alternating
            wide content rows (Popular Games, Top-Ups) with narrower
            centered trust rows (How it works, Why DropMarket). */}
        {/* V58 — Tactical duo as faint background art: large, low
            opacity, dissolving on every side so it sits IN the scene
            rather than on top of it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/characters/cs-duo.webp"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-16 top-1/2 z-0 hidden w-[560px] -translate-y-1/2 select-none object-contain opacity-[0.22] [mask-image:radial-gradient(ellipse_62%_62%_at_center,black_28%,transparent_78%)] lg:block"
        />
        <div className="mx-auto max-w-[1200px] px-6 relative z-10">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className="h-px w-8 bg-gradient-to-l from-[#C6FF3D66] to-transparent" aria-hidden />
              <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
                Why Choose DropMarket
              </span>
              <span className="h-px w-8 bg-gradient-to-r from-[#C6FF3D66] to-transparent" aria-hidden />
            </div>
            <h2 className="font-display text-display">
              Built so you can&apos;t get <span className="text-lime-text">burned</span>.
            </h2>
            <p className="mt-3 text-body-lg text-text-secondary">
              Every order runs through the same armor — SafeDrop Buyer Protection, vetted
              sellers, honest fees, and support that actually answers.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {WHY_CARDS.map((card, i) => (
              <WhyCard key={card.title} {...card} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          LIVE RECENTLY-SOLD TICKER
          DYNAMIC: from /api/recent-sales, WebSocket for real-time updates
          ================================================================ */}
      {recentSales.length > 0 && (
      <section className="relative py-12 border-t border-border-subtle overflow-hidden">
        {/* V17i — Subtle pulse-glow behind the ticker so the "live"
            beat is felt in the background, not just on the dot. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 animate-pulse"
          style={{
            background:
              'radial-gradient(80% 100% at 50% 0%, rgba(74,222,128,0.04), transparent 65%)',
            animationDuration: '3.5s',
          }}
        />
        <div className="relative z-10 max-w-container mx-auto px-6 mb-5 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-[9px] font-body font-semibold text-body-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live · just sold
            </span>
          </div>
          <span className="text-body-sm text-text-tertiary">Updated in real time across every game</span>
        </div>
        <div className="relative z-10">
          <RecentlySoldTicker items={recentSales} />
        </div>
      </section>
      )}

      {/* ================================================================
          CLOSING CTA — V57. Full-bleed: the Fortnite trio stands at
          center behind the headline, fading CIRCULARLY outward (radial
          mask) so the art melts into the page. One lime CTA, then the
          category strip — the whole marketplace, one tap away.
          ================================================================ */}
      <section className="relative overflow-hidden py-24 lg:py-28">
        {/* Ambient glow behind the composition */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(55% 65% at 50% 42%, rgba(198,255,61,0.07), transparent 65%),' +
              'radial-gradient(70% 80% at 50% 45%, rgba(120,168,255,0.05), transparent 70%)',
          }}
        />
        {/* Centered character art — fades circularly outward. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/characters/fortnite-trio.webp"
          alt=""
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-2 z-0 h-[560px] w-auto -translate-x-1/2 select-none object-contain opacity-[0.22] [mask-image:radial-gradient(ellipse_55%_58%_at_50%_42%,black_30%,transparent_80%)] sm:h-[700px] lg:h-[780px]"
        />

        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-display text-[40px] font-extrabold leading-[1.05] tracking-tight [text-shadow:0_4px_28px_rgba(0,0,0,0.85)] sm:text-[48px] lg:text-[58px]">
            What are you waiting for?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-body-lg text-text-secondary [text-shadow:0_2px_16px_rgba(0,0,0,0.9)]">
            Trade currency, items, and accounts with confidence — every order is
            covered by SafeDrop Buyer Protection. Get what you ordered, or your money back.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/browse"
              className="inline-flex h-[54px] items-center justify-center gap-2 rounded-lg bg-lime px-9 text-[17px] font-bold text-text-inverse transition-all duration-fast ease-gv hover:bg-lime-hover hover:shadow-glow active:bg-lime-pressed"
            >
              <LayoutGrid aria-hidden="true" className="h-5 w-5" />
              Browse Marketplace
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-[54px] items-center justify-center gap-2 rounded-lg border border-border-strong bg-[rgba(20,20,27,0.56)] px-8 text-[16px] font-semibold text-text-primary backdrop-blur-md transition-all duration-fast ease-gv hover:border-text-tertiary hover:bg-state-hover"
            >
              Create free account
            </Link>
          </div>
        </div>

        {/* Category strip — glass pills, the whole catalog one tap away. */}
        <div className="relative z-10 mx-auto mt-16 flex max-w-5xl flex-wrap items-center justify-center gap-3 px-6">
          {CTA_CATEGORIES.map(({ label, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="group relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-full border border-border-default bg-[rgba(20,20,27,0.56)] px-5 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-tint-border hover:bg-[rgba(26,26,35,0.75)]"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent)]"
              />
              <Icon
                aria-hidden="true"
                className="relative h-[17px] w-[17px] text-text-tertiary transition-colors group-hover:text-lime-text"
              />
              <span className="relative text-[14.5px] font-semibold text-text-secondary transition-colors group-hover:text-text-primary">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
