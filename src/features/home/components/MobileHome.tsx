'use client'

/**
 * MobileHome — Direction-A homepage composition below lg.
 *
 * Every export here is mounted with `lg:hidden` from HomePage so the
 * desktop layout stays byte-identical at lg+. Design language: forest
 * glass surfaces, lime demoted to whisper-level (ticks, live dots, one
 * accent phrase), 120ms pressed states on every tappable surface.
 *
 * Blocks:
 *   MobileHero            — headline + support line + hero search + category chips
 *   MobilePopularGames    — snap slider of compact 3:4 covers w/ category pills
 *   MobileProtectionStrip — 3-step "How You're Protected" strip → /safedrop
 *   MobileTrustRows       — 4 slim check rows (replaces the WhyCard grid)
 *   MobileRecentlySold    — compact live list rows from the ticker data
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Search,
  Coins,
  Check,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Headset,
} from 'lucide-react'

/* Deep forest-green for section links — readable on near-black without the
   neon of lime. Not a token yet; kept here until reused elsewhere. */
const FOREST_LINK = '#4FA96A'
import Image from 'next/image'
import Link from 'next/link'
import {
  Step1ChooseItem,
  Step2SecurePayment,
  Step3Delivery,
  Step4Confirm,
} from '@/components/icons/how-it-works'
import { SmartLink } from '@/components/global/SmartLink'
import type { PopularGame } from '../hooks/usePopularGames'
import type { SoldItem } from '../hooks/useRecentSales'
import { getGameIcon } from '../lib/game-icons'

/* ────────────────────────────────────────────────────────────
   Shared forest-glass recipe (house style)
   ──────────────────────────────────────────────────────────── */

const FOREST_GLASS =
  'border border-[rgba(163,230,53,0.10)] bg-[linear-gradient(180deg,#14241A,#0E1611)]'

/* Neutral "floating" surface for interactive chrome (chips, search,
   list rows): hairline + barely-there fill — the forest gradient is
   reserved for brand moments (protection strip, trust rows), per
   user feedback that green-filled buttons read heavy. */
const RAISED =
  'border border-white/[0.08] bg-white/[0.045]'

const PRESSED =
  'transition-all duration-[120ms] ease-out active:scale-[0.98] active:brightness-95'

// One mobile content gutter keeps section headers, sliders, cards and lists
// aligned to the same vertical rails instead of each block choosing its own
// inset. Six pixels of extra breathing room keeps the first card away from
// the viewport edge on narrow phones.
const MOBILE_GUTTER = 'px-6 sm:px-8'
// The cover rail follows its own card rhythm: 12px from the viewport edge,
// matching the 12px gap between the first and second card. Protection keeps
// the roomier shared gutter below.
const POPULAR_GAMES_GUTTER = 'px-3 sm:px-8'

/** Faint lime-warmed top sheen. Parent needs `relative overflow-hidden`. */
function Sheen() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-[linear-gradient(to_bottom,rgba(163,230,53,0.06),transparent)]"
    />
  )
}

/** Section header — .t-section title + optional View All link. */
function MobileSectionHeader({
  title,
  href,
  linkLabel = 'View All',
  gutterClass = MOBILE_GUTTER,
}: {
  title: React.ReactNode
  href?: string
  linkLabel?: string
  gutterClass?: string
}) {
  return (
    <div className={`mb-4 flex items-end justify-between gap-3 ${gutterClass}`}>
      <h2 className="t-section font-display">{title}</h2>
      {href && (
        <Link
          href={href}
          style={{ color: FOREST_LINK }}
          className={`group mb-0.5 inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-2 text-[13px] font-bold tracking-[-0.01em] ${PRESSED}`}
        >
          {linkLabel}
          <ArrowRight aria-hidden className="h-[17px] w-[17px] transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.75} />
        </Link>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   (1a) HERO SEARCH — same data + destinations as GlobalSearch
   ──────────────────────────────────────────────────────────── */

interface NavCatRow {
  slug: string
  name: string | null
  metadata: { label?: string; name?: string; type?: string } | null
  game: {
    name: string
    slug: string
    emoji?: string | null
    image_url?: string | null
    sort_order?: number | null
  } | null
}

interface MobileSearchCategory {
  slug: string
  label: string
}

interface MobileSearchGame {
  game: NonNullable<NavCatRow['game']>
  categories: MobileSearchCategory[]
}

/**
 * Same queryKey + shape as the navbar's nav-categories query, so the
 * two share one react-query cache entry (no duplicate fetch).
 */
function useNavCategories() {
  return useQuery({
    queryKey: ['nav-categories'],
    queryFn: async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase
        .from('categories')
        .select('slug, name, metadata, game_id, game:games!categories_game_id_fkey(name, slug, emoji, image_url, sort_order)')
        .eq('is_active', true)
        .order('display_order')
      return data || []
    },
    staleTime: 1000 * 60 * 5,
  })
}

const catLabel = (row: NavCatRow) =>
  row.name ||
  row.metadata?.label ||
  row.metadata?.name ||
  row.slug
    .replace(/^buy-/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

const compactSearchCategoryLabel = (label: string) => {
  const parenthetical = label.match(/^\s*[^()]+\(([^()]+)\)\s*$/)
  return parenthetical?.[1] ?? label
}

function MobileHeroSearch() {
  const router = useRouter()
  const { data: navCats } = useNavCategories()
  const [q, setQ] = useState('')
  // `focused` is intentionally the visibility state, rather than a literal
  // focus state. On mobile Safari/Chrome dismissing the software keyboard can
  // blur the input even though the user still wants to browse the results.
  // Keep the panel mounted until an actual outside pointer is detected.
  const [focused, setFocused] = useState(false)
  const searchRootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!focused) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && searchRootRef.current?.contains(target)) return
      setFocused(false)
    }

    // Capture before a link/button click, but only dismiss when the pointer is
    // outside the complete search surface. This replaces the old blur-driven
    // close and keeps the dropdown visible after the keyboard is hidden.
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
  }, [focused])

  const trimmed = q.trim()

  // Build one game row with its categories underneath, matching the grouped
  // desktop search index instead of rendering one flat row per category.
  const gameGroups = useMemo(() => {
    const grouped = new Map<string, MobileSearchGame>()
    for (const raw of (navCats ?? []) as unknown as NavCatRow[]) {
      const game = raw.game
      if (!game?.slug) continue
      const category = { slug: raw.slug, label: catLabel(raw) }
      const existing = grouped.get(game.slug)
      if (existing) {
        if (!existing.categories.some((item) => item.slug === category.slug)) {
          existing.categories.push(category)
        }
      } else {
        grouped.set(game.slug, { game, categories: [category] })
      }
    }
    return Array.from(grouped.values()).sort(
      (a, b) => (a.game.sort_order ?? 99) - (b.game.sort_order ?? 99),
    )
  }, [navCats])

  // Clicking into the empty field opens a useful game index immediately;
  // typing narrows it by game or category while retaining grouped rows.
  const matches = useMemo(() => {
    const needle = trimmed.toLowerCase()
    if (!needle) return gameGroups.slice(0, 10)
    return gameGroups
      .flatMap((entry) => {
        const gameHit =
          entry.game.name.toLowerCase().includes(needle) ||
          entry.game.slug.toLowerCase().includes(needle)
        const categoryHits = entry.categories.filter(
          (category) =>
            category.label.toLowerCase().includes(needle) ||
            category.slug.toLowerCase().includes(needle),
        )
        if (!gameHit && categoryHits.length === 0) return []
        return [{ ...entry, categories: gameHit ? entry.categories : categoryHits }]
      })
      .slice(0, 10)
  }, [gameGroups, trimmed])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmed) return
    setFocused(false)
    // Same fallback destination the navbar search uses.
    router.push(`/browse?search=${encodeURIComponent(trimmed)}`)
  }

  const open = focused

  return (
    <div ref={searchRootRef} className="relative -mx-3 sm:mx-0">
      <form onSubmit={submit} role="search">
        {/* Recessed dark field to match the engraved category tiles (F):
            deep inner shadow, hairline, quiet lime focus ring. */}
        <div
          className="relative flex h-[58px] items-center overflow-hidden rounded-[22px] border border-white/[0.09] bg-[radial-gradient(circle_at_50%_0%,rgba(30,32,38,0.92),rgba(11,12,15,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-10px_18px_-10px_rgba(0,0,0,0.85),0_12px_28px_-16px_rgba(0,0,0,0.9)] transition-colors focus-within:border-[rgba(198,255,61,0.35)] focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_3px_rgba(198,255,61,0.10),0_12px_28px_-16px_rgba(0,0,0,0.9)]"
        >
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center"
          >
            <Search className="h-[19px] w-[19px] text-white/45" />
          </span>
          <input
            type="search"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Search Games, Currency, Items…"
            aria-label="Search The Marketplace"
            aria-autocomplete="list"
            className="h-full w-full bg-transparent pl-1 pr-4 text-[15px] font-medium tracking-[-0.01em] text-white outline-none placeholder:font-medium placeholder:text-white/40 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      </form>

      {/* Grouped game picker — visibility is controlled by outside-pointer
          detection above. Do not prevent pointer defaults here: doing so on
          the parent suppresses the synthetic click on mobile links/buttons. */}
      {open && (
        <div
          role="listbox"
          aria-label="Game search results"
          className="absolute inset-x-0 top-[60px] z-50 overflow-hidden rounded-lg border border-border-subtle bg-card text-card-foreground shadow-elevated"
        >
          <div className="flex max-h-[min(520px,calc(100dvh-190px))] flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
              <span className="font-mono text-[11px] font-bold tracking-[0.18em] text-white/65">GAMES</span>
              <span className="text-[14px] font-medium tabular-nums text-white/55">{gameGroups.length || '—'}</span>
            </div>
            <div
              className="overflow-y-auto px-2 pb-3 [scrollbar-width:thin]"
              style={{ scrollbarColor: 'rgba(255,255,255,0.24) transparent' }}
            >
              {navCats === undefined ? (
                <div className="space-y-3 px-2 py-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-[68px] animate-pulse rounded-[14px] bg-white/[0.045]" />
                  ))}
                </div>
              ) : matches.length > 0 ? (
                <ul className="space-y-0.5">
                  {matches.map((entry) => (
                    <li key={entry.game.slug}>
                      <div className="rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.045]">
                        <div className="flex min-w-0 items-start gap-3">
                          <MobileSearchGameLogo game={entry.game} />
                          <div className="min-w-0 flex-1 pt-0.5 text-left">
                            <span className="block min-w-0 truncate text-[16px] font-semibold leading-tight tracking-[-0.01em] text-white">
                              {entry.game.name}
                            </span>
                            {entry.categories.length > 0 && (
                              <div className="mt-2 flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto pr-1 scrollbar-hide touch-pan-x">
                                {entry.categories.slice(0, 3).map((category) => (
                                  <Link
                                    key={category.slug}
                                    href={`/${entry.game.slug}/${category.slug}`}
                                    onClick={() => { setQ(''); setFocused(false) }}
                                    className={`inline-flex min-h-6 shrink-0 items-center whitespace-nowrap rounded-[9px] border border-white/[0.09] bg-white/[0.115] px-1.5 py-1 text-[10.5px] font-medium leading-none text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${PRESSED}`}
                                  >
                                    <span className="truncate">{compactSearchCategoryLabel(category.label)}</span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  className={`flex min-h-[72px] w-full items-center gap-3 rounded-[14px] px-3 text-left ${PRESSED}`}
                >
                  <Search aria-hidden className="h-5 w-5 shrink-0 text-white/45" />
                  <span className="truncate text-[14px] text-white/65">
                    Search the marketplace for “<span className="font-semibold text-white">{trimmed}</span>”
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MobileSearchGameLogo({ game }: { game: NonNullable<NavCatRow['game']> }) {
  const fallback = getGameIcon(game.slug.toLowerCase())
  const usableFallback = fallback.includes('game-fallback') ? null : fallback
  const [src, setSrc] = useState<string | null>(game.image_url || usableFallback)

  if (!src) {
    return (
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[11px] bg-white/[0.10] text-sm font-bold text-white/60 ring-1 ring-white/[0.08]">
        {(game.emoji || game.name.slice(0, 2)).toUpperCase()}
      </span>
    )
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setSrc((current) => (current !== usableFallback ? usableFallback : null))}
      className="h-12 w-12 shrink-0 rounded-[11px] object-cover shadow-[0_7px_16px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.10]"
    />
  )
}

/* ────────────────────────────────────────────────────────────
   (1) HERO — headline, support line, search, category chips
   ──────────────────────────────────────────────────────────── */

/* Chips open the navbar's category sub-screen (app-like) rather than
   dumping everyone on the same /browse page — tabId matches NAV_TABS
   in navbar-floating.tsx, which listens for dm:open-category. */
/* icon → the shared house category set (public/icons/categories), rendered
   with the white→forest gradient mask so hero chips match the hamburger. */
const HERO_CHIPS = [
  { label: 'Currencies', icon: 'currency', tabId: 'currency' },
  { label: 'Items', icon: 'items', tabId: 'items' },
  { label: 'Accounts', icon: 'accounts', tabId: 'accounts' },
  { label: 'Boosting', icon: 'boosting', tabId: 'boosting' },
  { label: 'Top Ups', icon: 'top-up', tabId: 'top-up' },
] as const

function maskStyle(icon: string): React.CSSProperties {
  return {
    maskImage: `url(/icons/categories/${icon}.svg)`,
    WebkitMaskImage: `url(/icons/categories/${icon}.svg)`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  }
}

/** Bare platinum-filled category glyph (quiet near-white), masked from the
 *  shared house SVG set. The material lives in CategoryTile, not here. */
function CategoryGlyph({
  icon,
  className = '',
  style,
}: {
  icon: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      aria-hidden
      className={`bg-[linear-gradient(180deg,#ffffff,#d8dde1)] drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] ${className}`}
      style={{ ...maskStyle(icon), ...style }}
    />
  )
}

/** Frosted-glass tile wrapping a quiet platinum glyph — the premium
 *  "Apple settings row" treatment. One look everywhere a category icon
 *  appears (hero rail + hamburger). Size the tile via `size`. */
function CategoryTile({
  icon,
  size = 44,
  iconSize = 22,
  className = '',
}: {
  icon: string
  size?: number
  iconSize?: number
  className?: string
}) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-[13px] border border-white/[0.07] bg-[radial-gradient(circle_at_50%_18%,rgba(38,40,46,0.9),rgba(12,13,16,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-8px_14px_-8px_rgba(0,0,0,0.85)] ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Faint top edge-light only — recessed, engraved feel (treatment F). */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.07),transparent)]" />
      <CategoryGlyph icon={icon} className="relative" style={{ width: iconSize, height: iconSize }} />
    </span>
  )
}

export function MobileHero() {
  return (
    <section className={`relative z-30 ${MOBILE_GUTTER} pb-1 pt-6 text-center`}>
      {/* Trust pill — honest pre-launch signal only (no invented order
          counts, matching the StatsMarquee copy rule). */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 backdrop-blur-md"
      >
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
        </span>
        <span className="text-[11.5px] font-semibold tracking-[-0.01em] text-white/75">
          SafeDrop Buyer Protection on Every Order
        </span>
      </motion.div>

      {/* Hero title — oversized, confident, single accent line. Clean:
          one soft shadow for legibility over the hero image, no 3D stack. */}
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="text-center font-display text-[clamp(40px,12.5vw,60px)] font-black leading-[0.9] tracking-[-0.06em] text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.55)]"
      >
        <span className="block">The Safest Way</span>
        <span className="relative block bg-[linear-gradient(100deg,#4ade80,#c6ff3d,#fff,#c6ff3d)] bg-[length:240%_100%] bg-clip-text text-transparent animate-gradient-x">
          to Level Up.
        </span>
      </motion.h1>
      <p className="mx-auto mt-3 max-w-[30ch] text-[15px] font-medium leading-snug text-white/65 [text-shadow:0_1px_12px_rgba(0,0,0,0.7)]">
        Buy accounts, currency and items — held in escrow until you say it&apos;s
        delivered.
      </p>

      <div className="mt-4">
        <MobileHeroSearch />
      </div>

      {/* Category rail — even 5-column grid so tiles line up on one grid
          and labels center under each. All 5 fit at every phone width. */}
      <div className="mt-5 grid grid-cols-5 gap-1.5">
        {HERO_CHIPS.map(({ label, icon, tabId }) => (
          <button
            key={label}
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('dm:open-category', { detail: tabId }),
              )
            }
            className={`group flex flex-col items-center gap-2 ${PRESSED}`}
          >
            <CategoryTile
              icon={icon}
              size={52}
              iconSize={26}
              className="transition-colors group-hover:border-white/[0.2] group-hover:bg-white/[0.09]"
            />
            <span className="w-full truncate text-center text-[11.5px] font-semibold leading-none tracking-[-0.01em] text-white/70 transition-colors group-hover:text-white">
              {label}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────
   (2) POPULAR GAMES — compact snap slider w/ category pills
   ──────────────────────────────────────────────────────────── */

const MAX_PILLS = 3

/* Per user direction: only the core buying categories under a game —
   currency/items/accounts. Boosting, top-ups, coaching, gift cards etc.
   stay reachable from the game hub, not the homepage pills. */
const PILL_EXCLUDE = /boost|top.?up|coach|gift|server|key/i

function GamePills({ game }: { game: PopularGame }) {
  const shown = game.categoryLinks
    .filter((c) => !PILL_EXCLUDE.test(c.slug) && !PILL_EXCLUDE.test(c.label))
    .slice(0, MAX_PILLS)
  if (shown.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-1">
      {shown.map((c) => (
        <Link
          key={c.slug}
          href={`/${game.slug}/${c.slug}`}
          className={`relative inline-flex min-h-7 max-w-full items-center overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.12] px-2 ${PRESSED}`}
        >
          <span className="truncate text-[10.5px] font-semibold text-text-secondary">
            {c.label.replace(/\s*\(.*?\)\s*/g, '')}
          </span>
        </Link>
      ))}
    </div>
  )
}

export function MobilePopularGames({ games }: { games: PopularGame[] }) {
  return (
    <section className="relative z-10 pt-8">
      <MobileSectionHeader title="Popular Games" href="/browse" gutterClass={POPULAR_GAMES_GUTTER} />
      <div className={`flex snap-x gap-3 overflow-x-auto ${POPULAR_GAMES_GUTTER} [scroll-padding-inline:0.75rem] pb-1 scrollbar-hide sm:[scroll-padding-inline:2rem]`}>
        {games.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-[124px] shrink-0 snap-start sm:w-[136px]">
                <div className={`aspect-[5/6] w-full animate-pulse rounded-xl ${RAISED}`} />
                <div className="mt-2 h-4 w-20 animate-pulse rounded bg-[rgba(20,36,26,0.8)]" />
              </div>
            ))
          : games.map((game) => (
              <div key={game.slug} className="w-[124px] shrink-0 snap-start sm:w-[136px]">
                <SmartLink href={game.href} className={`block ${PRESSED}`}>
                  <div className="relative aspect-[5/6] w-full overflow-hidden rounded-xl border border-border-subtle bg-bg-raised shadow-elevated">
                    <Image
                      src={game.coverSrc}
                      alt={game.name}
                      fill
                      sizes="124px"
                      className="object-cover"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent"
                    />
                  </div>
                  <span className="t-card mt-2 block truncate px-0.5 text-center !text-white [text-shadow:0_1px_10px_rgba(255,255,255,0.14)]">
                    {game.name}
                  </span>
                </SmartLink>
                <GamePills game={game} />
              </div>
            ))}
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────
   (3) PROTECTION STRIP — 3 outcome steps → /safedrop
   ──────────────────────────────────────────────────────────── */

/* Each card is lit by its OWN icon's ambient color (steel / red /
   amber / lime) over a neutral deep surface — no green wash. */
const PROTECTION_STEPS = [
  { num: '01', title: 'Choose Your Item', copy: 'Compare offers, buy with confidence.', Icon: Step1ChooseItem, glow: 'rgba(148,178,255,0.14)' },
  { num: '02', title: 'Pay Securely', copy: 'Covered by SafeDrop from the first second.', Icon: Step2SecurePayment, glow: 'rgba(255,120,120,0.13)' },
  { num: '03', title: 'Get Your Delivery', copy: 'Fast in-game delivery, tracked live.', Icon: Step3Delivery, glow: 'rgba(255,190,90,0.13)' },
  { num: '04', title: 'Confirm Delivery', copy: 'Seller is paid after you confirm — or your money back.', Icon: Step4Confirm, glow: 'rgba(163,230,53,0.14)' },
] as const

export function MobileProtectionStrip() {
  return (
    <section className="relative z-10 pt-8">
      <MobileSectionHeader title="How You're Protected" href="/safedrop" linkLabel="SafeDrop" />
      <div className={`-mb-1 flex snap-x gap-3 overflow-x-auto ${MOBILE_GUTTER} [scroll-padding-inline:1.5rem] pb-2 scrollbar-hide sm:[scroll-padding-inline:2rem]`}>
        {PROTECTION_STEPS.map(({ num, title, copy, Icon, glow }) => (
          <Link
            key={num}
            href="/safedrop"
            className={`relative min-w-[204px] shrink-0 snap-start overflow-hidden rounded-xl border border-white/[0.07] bg-[linear-gradient(180deg,#111311,#0A0C0A)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_28px_-14px_rgba(0,0,0,0.6)] ${PRESSED}`}
          >
            {/* Ambient halo in the icon's own color */}
            <span
              aria-hidden
              className="pointer-events-none absolute -left-6 -top-8 h-32 w-32 rounded-full blur-2xl"
              style={{ background: `radial-gradient(circle, ${glow}, transparent 70%)` }}
            />
            {/* Ghost step numeral watermark */}
            <span
              aria-hidden
              className="pointer-events-none absolute -top-2 right-2 select-none text-[58px] font-black leading-none tracking-tight text-white/[0.05]"
            >
              {num}
            </span>
            {/* The shared 3D step icon floats over the halo */}
            <Icon className="relative h-12 w-12 drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)]" />
            <span className="t-card relative mt-3 block text-text-primary">{title}</span>
            <span className="t-cap relative mt-1 block leading-snug text-text-secondary">{copy}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────────────────────
   (4) TRUST ROWS — 4 slim check rows (WhyCard copy, condensed)
   ──────────────────────────────────────────────────────────── */

const TRUST_ROWS = [
  {
    claim: 'SafeDrop on Every Order',
    proof: 'Sellers are paid only after you confirm delivery.',
  },
  {
    claim: 'Sellers Earn Their Spot',
    proof: 'ID checks, payment verification and live ratings.',
  },
  {
    claim: "Fees That Don't Sting",
    proof: 'Sellers pay 5–10%, not the 17–26% others skim.',
  },
  {
    claim: 'Humans, Around the Clock',
    proof: 'Support and dispute resolution never close.',
  },
] as const

/* Compact ports of the desktop WhyCards: grey glass, giant ghost icon
   watermark, the 3D trust art with its tone glow — the look the user
   asked to keep, at 2-up phone size. */
const TRUST_CARDS = [
  { claim: 'SafeDrop On Every Order', proof: 'Sellers are paid only after you confirm delivery.', img: '/icons/trust/money-back.png', Ghost: ShieldCheck, glow: 'rgba(198,255,61,0.28)' },
  { claim: 'Sellers Earn Their Spot', proof: 'ID checks, payment verification and live ratings.', img: '/icons/safedrop-emblem.png', Ghost: ShieldCheck, glow: 'rgba(74,222,128,0.30)' },
  { claim: "Fees That Don't Sting", proof: 'Sellers pay 5\u201310%, not the 17\u201326% others skim.', img: '/how-it-works/step-2.png', Ghost: Coins, glow: 'rgba(251,191,36,0.28)' },
  { claim: 'Humans, Around The Clock', proof: 'Support and dispute resolution never close.', img: '/icons/trust/support.png', Ghost: Headset, glow: 'rgba(96,165,250,0.32)' },
] as const

export function MobileTrustRows() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {TRUST_CARDS.map(({ claim, proof, img, Ghost, glow }) => (
        <div
          key={claim}
          className="relative overflow-hidden rounded-xl border border-border-default bg-[rgba(20,20,27,0.56)] p-3.5 backdrop-blur-md"
        >
          {/* Top sheen */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent)]"
          />
          {/* Ghost icon watermark, corner-anchored like desktop */}
          <Ghost
            aria-hidden
            className="pointer-events-none absolute -bottom-4 -right-3 h-20 w-20 rotate-12 text-white opacity-[0.05]"
          />
          {/* 3D trust art with its tone glow */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt=""
            aria-hidden
            style={{ ['--icon-glow' as string]: glow } as React.CSSProperties}
            className="relative h-10 w-10 object-contain [filter:drop-shadow(0_6px_8px_rgba(0,0,0,0.55))_drop-shadow(0_0_12px_var(--icon-glow))]"
          />
          <span className="t-card relative mt-2.5 block text-text-primary">{claim}</span>
          <span className="t-cap relative mt-1 block leading-snug text-text-secondary">{proof}</span>
        </div>
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   (5) RECENTLY SOLD — compact live list rows
   ──────────────────────────────────────────────────────────── */

export function MobileRecentlySold({ items }: { items: SoldItem[] }) {
  const rows = items.slice(0, 6)
  if (rows.length === 0) return null
  return (
    <section className="relative z-10">
      <MobileSectionHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            Recently Sold
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
          </span>
        }
      />
      <div className={`flex flex-col gap-2 ${MOBILE_GUTTER}`}>
        {rows.map((item) => (
          <div
            key={item.id}
            className={`relative flex items-center gap-3 overflow-hidden rounded-xl p-3 ${FOREST_GLASS}`}
          >
            <Sheen />
            {/* Game monogram chip w/ live dot */}
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[rgba(163,230,53,0.14)] bg-[rgba(163,230,53,0.06)]">
              <span className="text-[13px] font-bold text-text-secondary" aria-hidden>
                {item.game.charAt(0).toUpperCase()}
              </span>
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success shadow-[0_0_6px_rgba(74,222,128,0.8)]"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="t-card block truncate text-text-primary">{item.item}</span>
              <span className="t-cap block truncate text-text-tertiary">{item.game}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[13.5px] font-bold tabular-nums text-text-primary">
                ${item.amount.toLocaleString()}
              </span>
              <span className="t-cap block text-text-tertiary">{item.ago}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
