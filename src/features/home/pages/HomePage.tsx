'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Coins,
  Headset,
  LayoutGrid,
  Gift,
} from 'lucide-react'

import { HeroCarousel } from '../components/HeroCarousel'
import { RowHeader } from '../components/RowHeader'
import { TopUpsBanner } from '../components/TopUpsBanner'
import { HorizontalScroller } from '../components/HorizontalScroller'
import { GameCard } from '../components/GameCard'
import { CurrencyCard } from '../components/CurrencyCard'
import { StatsMarquee } from '../components/StatsMarquee'
import { HowItWorks } from '../components/HowItWorks'
import { WhyCard } from '../components/WhyCard'
import { RecentlySoldTicker } from '../components/RecentlySoldTicker'
import { PaymentsMarquee } from '@/components/marketplace/PaymentsMarquee'
import TrustBox, { TRUSTBOX_TEMPLATES } from '@/components/trust/TrustBox'
import {
  MobileHero,
  MobilePopularGames,
  MobileProtectionStrip,
  MobileTrustRows,
} from '../components/MobileHome'

import { useHeroSlides } from '../hooks/useHeroSlides'
import { usePopularGames } from '../hooks/usePopularGames'
import { usePopularCurrencies } from '../hooks/usePopularCurrencies'
import { usePopularItems, usePopularAccounts, usePopularTopups } from '../hooks/usePopularCategories'
import { useRecentSales } from '../hooks/useRecentSales'
import { formatFromPrice } from '../lib/popular-listings'
import { getGameIcon } from '../lib/game-icons'



type MarketplaceRailItem = {
  href: string
  name: string
  game: string
  iconSrc?: string | null
  fromPrice: number
  listingCount?: number
}

type MarketplaceRailSlide = {
  id: 'currencies' | 'items' | 'accounts'
  title: string
  items: MarketplaceRailItem[]
}

/**
 * Visual fill for a young marketplace: live rows always lead, then these
 * existing game assets complete a five-cover editorial list while a category
 * is still building inventory. Each link lands on the matching browse route.
 */
const MARKETPLACE_RAIL_FILLERS: Record<MarketplaceRailSlide['id'], MarketplaceRailItem[]> = {
  currencies: [
    { href: '/roblox/buy-robux', name: 'Robux', game: 'Roblox', iconSrc: '/games/roblox.png', fromPrice: 0.0044 },
    { href: '/fortnite/buy-vbucks', name: 'V-Bucks', game: 'Fortnite', iconSrc: '/games/fortnite.png', fromPrice: 4.99 },
    { href: '/genshin-impact/genesis-crystals', name: 'Genesis Crystals', game: 'Genshin Impact', iconSrc: '/games/genshin.png', fromPrice: 3.99 },
    { href: '/fc25/fc-points', name: 'FC Points', game: 'EA Sports FC 25', iconSrc: '/games/fc25.png', fromPrice: 5.99 },
    { href: '/call-of-duty/cod-points', name: 'COD Points', game: 'Call of Duty', iconSrc: '/games/cod.png', fromPrice: 7.99 },
  ],
  items: [
    { href: '/roblox/buy-items', name: 'Items', game: 'Roblox', iconSrc: '/games/roblox.png', fromPrice: 1.99 },
    { href: '/fortnite/buy-items', name: 'Skins', game: 'Fortnite', iconSrc: '/games/fortnite.png', fromPrice: 2.99 },
    { href: '/cs2/buy-items', name: 'Skins', game: 'Counter-Strike 2', iconSrc: '/games/cs2.png', fromPrice: 0.99 },
    { href: '/valorant/buy-items', name: 'Weapon Skins', game: 'Valorant', iconSrc: '/games/valorant.png', fromPrice: 4.99 },
    { href: '/minecraft/items', name: 'Items', game: 'Minecraft', iconSrc: '/games/minecraft.png', fromPrice: 1.49 },
  ],
  accounts: [
    { href: '/fortnite/buy-accounts', name: 'Accounts', game: 'Fortnite', iconSrc: '/games/fortnite.png', fromPrice: 7.99 },
    { href: '/valorant/accounts', name: 'Accounts', game: 'Valorant', iconSrc: '/games/valorant.png', fromPrice: 8.99 },
    { href: '/gta-v/buy-accounts', name: 'Accounts', game: 'Grand Theft Auto V', iconSrc: '/games/gta-v.png', fromPrice: 9.99 },
    { href: '/cs2/buy-accounts', name: 'Accounts', game: 'Counter-Strike 2', iconSrc: '/games/cs2.png', fromPrice: 4.99 },
    { href: '/genshin-impact/accounts', name: 'Accounts', game: 'Genshin Impact', iconSrc: '/games/genshin.png', fromPrice: 6.99 },
    { href: '/league-of-legends/accounts', name: 'Accounts', game: 'League of Legends', iconSrc: '/games/lol.png', fromPrice: 5.99 },
  ],
}

function completeMarketplaceRail(
  items: MarketplaceRailItem[],
  category: MarketplaceRailSlide['id'],
): MarketplaceRailItem[] {
  const hasArtwork = (item: MarketplaceRailItem) =>
    Boolean(item.iconSrc && !item.iconSrc.includes('game-fallback'))
  const completeLiveRows = items
    .map((item) => {
      if (hasArtwork(item)) return item
      const gameSlug = item.href.split('/').filter(Boolean)[0] ?? ''
      const registeredIcon = getGameIcon(gameSlug)
      return {
        ...item,
        iconSrc: registeredIcon.includes('game-fallback') ? item.iconSrc : registeredIcon,
      }
    })
    .filter(hasArtwork)
  const seen = new Set<string>()
  const completed: MarketplaceRailItem[] = []

  for (const liveItem of completeLiveRows) {
    const key = liveItem.game.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    completed.push(liveItem)
    if (completed.length >= 5) return completed
  }

  for (const filler of MARKETPLACE_RAIL_FILLERS[category]) {
    const key = filler.game.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    completed.push(filler)
    if (completed.length >= 5) break
  }

  return completed.slice(0, 5)
}

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
              categoryLinks={game.categoryLinks}
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

function ShopByCategoryShelf({
  currencies,
  items,
  accounts,
}: {
  currencies: ReturnType<typeof usePopularCurrencies>['data']
  items: ReturnType<typeof usePopularItems>['data']
  accounts: ReturnType<typeof usePopularAccounts>['data']
}) {
  // Keep the order intentional: Currency → Items → Accounts. This is a
  // finite editorial rail, so the last panel only moves back toward Items.
  const slides: MarketplaceRailSlide[] = [
    {
      id: 'currencies',
      title: 'Top Currency',
      items: completeMarketplaceRail(
        (currencies ?? []).map((currency) => ({
          ...currency,
          href: `/${currency.slug}`,
        })),
        'currencies',
      ),
    },
    { id: 'items', title: 'Top Items', items: completeMarketplaceRail(items ?? [], 'items') },
    { id: 'accounts', title: 'Top Accounts', items: completeMarketplaceRail(accounts ?? [], 'accounts') },
  ]
  // Embla drives the swipe/drag (native momentum + snapping) instead of the
  // old hand-rolled touch math. `align: 'start'` + trimSnaps means EVERY
  // slide — including the last (Accounts) — snaps flush to the left edge, so
  // the final panel no longer sticks to the right. On md+ two panels show.
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    skipSnaps: false,
  })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const scrollTo = useCallback((idx: number) => emblaApi?.scrollTo(idx), [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap())
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
  }, [emblaApi])

  const lastIndex = slides.length - 1

  return (
    <div className="relative">
      <div ref={emblaRef} className="overflow-hidden" aria-label="Browse popular marketplace categories">
        <div className="flex touch-pan-y">
          {slides.map((slide, index) => (
            <CategoryRailPanel
              key={slide.id}
              slide={slide}
              onNext={() => scrollTo(Math.min(index + 1, lastIndex))}
              canAdvance={index < lastIndex}
              // Divider sits BETWEEN sections — never after the last one.
              showDivider={index < lastIndex}
            />
          ))}
          {/* Trailing spacer (~26% on phones) so Embla can pull the LAST real
              slide (Accounts) fully flush-left with nothing peeking, while
              slides 1 & 2 still show the next panel peeking. Empty + hidden
              from AT / not a snap point on md+. */}
          <div aria-hidden className="w-[26%] shrink-0 grow-0 basis-[26%] md:hidden" />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 pt-7" role="tablist" aria-label="Marketplace categories">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={index === selectedIndex}
            aria-label={`Show ${slide.title}`}
            onClick={() => scrollTo(index)}
            className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${index === selectedIndex ? 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.7)]' : 'bg-white/25 hover:bg-white/45'}`}
          />
        ))}
      </div>
    </div>
  )
}

function CategoryRailPanel({
  slide,
  onNext,
  canAdvance,
  showDivider,
}: {
  slide: MarketplaceRailSlide
  onNext: () => void
  canAdvance: boolean
  showDivider: boolean
}) {
  return (
    <section
      aria-label={slide.title}
      // Embla slide: ~74% on phones so the NEXT panel peeks (signals "swipe
      // for more") on slides 1 & 2; a trailing spacer lets the last slide
      // (Accounts) still land flush-left with nothing peeking. Two-up (50%)
      // from md. pr gives the rows breathing room before the divider seam.
      className="relative w-[74%] shrink-0 grow-0 basis-[74%] pb-2 pr-8 sm:pr-10 md:basis-1/2 md:w-1/2 md:pr-12 md:pl-4"
    >
      <div className="mb-5 flex items-center gap-1.5 sm:mb-6">
        <h3 className="font-display text-[21px] font-extrabold leading-none tracking-tight text-white sm:text-[27px]">
          {slide.title}
        </h3>
        {canAdvance ? (
          <button
            type="button"
            onClick={onNext}
            aria-label={`Next category after ${slide.title}`}
            className="inline-flex shrink-0 items-center justify-center p-0.5 text-white/85 transition-transform hover:translate-x-1 hover:text-white active:scale-90"
          >
            <ChevronRight aria-hidden="true" className="h-5 w-5" strokeWidth={2.1} />
          </button>
        ) : null}
      </div>

      <div
        className={`relative space-y-1 ${
          // Between-section divider sits in the panel's right-padding gap,
          // well clear of the icon/name, so it reads as a section seam next
          // to the peeking panel. Never rendered after the last section.
          showDivider
            ? "after:absolute after:inset-y-0 after:-right-4 after:w-px after:bg-white/[0.16] after:content-[''] sm:after:-right-5 md:after:-right-6"
            : ''
        }`}
      >
        {slide.items.slice(0, 5).map((item) => (
          <CategoryRailItem key={item.href ?? `${item.game}-${item.name}`} item={item} />
        ))}
      </div>
    </section>
  )
}

function CategoryRailItem({ item }: { item: MarketplaceRailItem }) {
  return (
    <Link
      href={item.href?.startsWith('/') ? item.href : `/${item.href}`}
      className="group flex min-h-[74px] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.045] sm:min-h-[104px] sm:gap-4 sm:px-4 sm:py-2.5"
    >
      <CategoryRailArtwork item={item} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold leading-[1.15] text-white group-hover:text-lime-text sm:text-[19px]">
          {item.game}
        </span>
        <span className="mt-0.5 block truncate text-[11px] leading-tight text-white/48 sm:text-[13px]">
          {item.name}{item.listingCount ? ` · ${item.listingCount.toLocaleString()} listings` : ''}
        </span>
        <span className="mt-1.5 block text-[12px] font-semibold leading-none tabular-nums text-white/85 sm:mt-2 sm:text-[15px]">
          <span className="mr-1 text-[9px] font-medium uppercase tracking-[0.1em] text-white/38 sm:text-[10px]">from</span>
          ${formatFromPrice(Number(item.fromPrice ?? 0))}
        </span>
      </span>
    </Link>
  )
}

function CategoryRailArtwork({ item }: { item: MarketplaceRailItem }) {
  const gameSlug = item.href.split('/').filter(Boolean)[0] ?? ''
  const registeredIcon = getGameIcon(gameSlug)
  const fallbackIcon = registeredIcon.includes('game-fallback') ? null : registeredIcon
  const suppliedIcon = item.iconSrc && !item.iconSrc.includes('game-fallback') ? item.iconSrc : null
  const [art, setArt] = useState<string | null>(suppliedIcon ?? fallbackIcon)

  useEffect(() => {
    setArt(suppliedIcon ?? fallbackIcon)
  }, [fallbackIcon, suppliedIcon])

  if (!art) {
    return (
      <span className="grid h-[58px] w-11 shrink-0 place-items-center rounded-md bg-white/[0.08] text-base font-bold text-white/45 sm:h-[88px] sm:w-[68px]">
        {item.game?.charAt(0) ?? '?'}
      </span>
    )
  }

  return (
    <Image
      src={art}
      alt=""
      width={68}
      height={88}
      onError={() => setArt((current) => (current !== fallbackIcon ? fallbackIcon : null))}
      className="h-[58px] w-11 shrink-0 rounded-md object-cover shadow-[0_7px_14px_rgba(0,0,0,0.38)] sm:h-[88px] sm:w-[68px]"
    />
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

      {/* MOBILE (below lg) — Direction-A composition: hero copy + search
          + category chips, then the compact Popular Games slider and the
          3-step protection strip. Desktop sections below carry
          max-lg:hidden so lg+ stays byte-identical. */}
      <div className="lg:hidden">
        <MobileHero />
        <MobilePopularGames games={popularGames} />
        <MobileProtectionStrip />
      </div>

      <section className="max-lg:hidden relative flex flex-col h-[calc(100svh-160px)] min-h-[480px] py-5 px-6 overflow-hidden">

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
      <section className="max-lg:hidden relative py-20">
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
            {/* App-shell — `t-section` supplies the 20px phone size; the
                existing sm/lg utilities restore 44/56px so md+ desktop is
                byte-identical (utilities layer beats .t-section). */}
            <h2 className="t-section font-display font-extrabold leading-[1.04] tracking-tight sm:text-[44px] lg:text-[56px]">
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
      <section className="max-lg:hidden relative py-10">
        <StatsMarquee />
      </section>

      {/* ================================================================
          HOW IT WORKS
          ================================================================ */}
      {/* V20/P16 — Apple-style scroll-pinned How It Works. Sticky stage
          on the right cross-fades through 4 hero illustrations as the
          copy column on the left scrolls past 4 stages.
          Mobile — replaced by the 3-step protection strip up top. */}
      <div className="max-lg:hidden">
        <HowItWorks />
      </div>

      {/* ================================================================
          FLOATING MARKETPLACE RAIL — three editorial slides:
          item drops, currency picks and selling accounts.
          ================================================================ */}
      <section id="marketplace-rail" className="relative py-20 max-lg:py-10 overflow-hidden">
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
      <section id="top-ups" className="max-lg:hidden relative py-20 border-y border-border-subtle overflow-hidden">
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
      <section className="relative py-20 max-lg:py-10 overflow-hidden">
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
          <div className="mx-auto max-w-2xl text-center mb-12 max-lg:mb-6">
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className="h-px w-8 bg-gradient-to-l from-[#C6FF3D66] to-transparent" aria-hidden />
              <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
                Why Choose DropMarket
              </span>
              <span className="h-px w-8 bg-gradient-to-r from-[#C6FF3D66] to-transparent" aria-hidden />
            </div>
            {/* App-shell — t-section on phones, md:text-display restores 38px. */}
            <h2 className="t-section font-display md:text-display">
              Built so you can&apos;t get <span className="text-lime-text">burned</span>.
            </h2>
            <p className="mt-3 text-body-lg text-text-secondary">
              Every order runs through the same armor — SafeDrop Buyer Protection, vetted
              sellers, honest fees, and support that actually answers.
            </p>
          </div>
          {/* Desktop — the 4 illustrated WhyCards, untouched at lg+. */}
          <div className="max-lg:hidden grid grid-cols-1 lg:grid-cols-2 gap-5">
            {WHY_CARDS.map((card, i) => (
              <WhyCard key={card.title} {...card} index={i} />
            ))}
          </div>
          {/* Mobile — 4 slim check rows (same claims, condensed proof). */}
          <div className="lg:hidden">
            <MobileTrustRows />
          </div>

          {/* Trustpilot rating — compact micro widget (stars + rating +
              count on one line). Stays tidy even with few/no reviews, unlike
              the carousel which renders a big empty box. Lazy-loaded; renders
              nothing until the env var is set. */}
          <div className="mt-8 flex justify-center sm:mt-10">
            <TrustBox
              templateId={TRUSTBOX_TEMPLATES.microCombo}
              height="28px"
              width="280px"
              theme="dark"
            />
          </div>
        </div>
      </section>

      {/* ================================================================
          LIVE RECENTLY-SOLD TICKER
          DYNAMIC: from /api/recent-sales, WebSocket for real-time updates
          ================================================================ */}
      {recentSales.length > 0 && (
      <section className="relative py-12 max-lg:py-8 border-t border-border-subtle overflow-hidden">
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
        {/* Mobile — compact heading; the infinite marquee below runs at
            every width (user preferred the ticker over list rows). */}
        <div className="lg:hidden relative z-10 mb-4 flex items-center gap-2 px-6 sm:px-8">
          <h2 className="t-section text-text-primary">Recently Sold</h2>
          <span aria-hidden className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
        </div>
        <div className="max-lg:hidden relative z-10 max-w-container mx-auto px-6 mb-5 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
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
      {/* Payment methods marquee — mobile only (desktop has it in the
          checkout/detail surfaces; here it closes the phone homepage). */}
      <section className="lg:hidden border-t border-border-subtle py-4">
        <PaymentsMarquee />
      </section>

      <section className="relative overflow-hidden py-10 max-lg:pb-12 lg:py-28">
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
          className="pointer-events-none absolute left-1/2 top-2 z-0 h-[430px] w-auto -translate-x-1/2 select-none object-contain opacity-[0.22] [mask-image:radial-gradient(ellipse_55%_58%_at_50%_42%,black_30%,transparent_80%)] sm:h-[700px] lg:h-[780px]"
        />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="font-display text-[28px] font-extrabold leading-[1.05] tracking-tight [text-shadow:0_4px_28px_rgba(0,0,0,0.85)] sm:text-[44px] lg:text-[58px]">
            What are you waiting for?
          </h2>
          <p className="mx-auto mt-3 max-w-[34ch] text-[15px] leading-[1.5] text-text-secondary [text-shadow:0_2px_16px_rgba(0,0,0,0.9)] sm:max-w-xl sm:text-body-lg">
            Trade currency, items, and accounts with confidence — every order is
            covered by SafeDrop Buyer Protection. Get what you ordered, or your money back.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:mt-9 lg:gap-3">
            <Link
              href="/browse"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-lime px-6 text-[15px] font-bold text-text-inverse transition-all duration-fast ease-gv hover:bg-lime-hover hover:shadow-glow active:bg-lime-pressed lg:h-[54px] lg:px-9 lg:text-[17px]"
            >
              <LayoutGrid aria-hidden="true" className="h-[18px] w-[18px] lg:h-5 lg:w-5" />
              Browse Marketplace
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border-strong bg-[rgba(20,20,27,0.56)] px-6 text-[15px] font-semibold text-text-primary backdrop-blur-md transition-all duration-fast ease-gv hover:border-text-tertiary hover:bg-state-hover lg:h-[54px] lg:px-8 lg:text-[16px]"
            >
              Create free account
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
