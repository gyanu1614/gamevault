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

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  Coins,
  Swords,
  User,
  Rocket,
  Zap,
  Check,
  ChevronRight,
} from 'lucide-react'
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
}: {
  title: React.ReactNode
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 px-5">
      <h2 className="t-section font-display">{title}</h2>
      {href && (
        <Link
          href={href}
          className={`mb-0.5 inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full px-2 text-[12.5px] font-semibold text-lime-text ${PRESSED}`}
        >
          {linkLabel}
          <span aria-hidden>→</span>
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
  game: { name: string; slug: string; sort_order?: number | null } | null
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

function MobileHeroSearch() {
  const router = useRouter()
  const { data: navCats } = useNavCategories()
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)

  const trimmed = q.trim()

  // Client-side matches against game + category names — the same index
  // GlobalSearch builds. Rows navigate to /{game}/{category}.
  const matches = useMemo(() => {
    if (!trimmed) return []
    const needle = trimmed.toLowerCase()
    const out: { gameName: string; gameSlug: string; catLabel: string; catSlug: string }[] = []
    for (const raw of (navCats ?? []) as unknown as NavCatRow[]) {
      const game = raw.game
      if (!game?.slug) continue
      const label = catLabel(raw)
      const hit =
        game.name.toLowerCase().includes(needle) ||
        game.slug.toLowerCase().includes(needle) ||
        label.toLowerCase().includes(needle) ||
        raw.slug.toLowerCase().includes(needle)
      if (hit) {
        out.push({ gameName: game.name, gameSlug: game.slug, catLabel: label, catSlug: raw.slug })
      }
      if (out.length >= 6) break
    }
    return out
  }, [navCats, trimmed])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmed) return
    setFocused(false)
    // Same fallback destination the navbar search uses.
    router.push(`/browse?search=${encodeURIComponent(trimmed)}`)
  }

  const open = focused && trimmed.length > 0

  return (
    <div className="relative">
      <form onSubmit={submit} role="search">
        <div
          className={`relative flex h-[52px] items-center overflow-hidden rounded-xl ${RAISED} transition-colors focus-within:border-white/[0.18] focus-within:ring-1 focus-within:ring-white/[0.12]`}
        >
          <Sheen />
          <Search
            aria-hidden
            className="pointer-events-none absolute left-4 h-[18px] w-[18px] text-text-tertiary"
          />
          <input
            type="search"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search games, currencies, items…"
            aria-label="Search the marketplace"
            className="h-full w-full bg-transparent pl-12 pr-4 text-base text-text-primary outline-none placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      </form>

      {/* Suggestions — forest-glass panel under the bar. Rows use
          onPointerDown preventDefault so the input blur doesn't kill
          the tap before the Link click lands. */}
      {open && (
        <div
          className={`absolute inset-x-0 top-[60px] z-30 overflow-hidden rounded-xl border border-white/[0.10] bg-[#121512] shadow-[0_16px_40px_rgba(0,0,0,0.55)]`}
          onPointerDown={(e) => e.preventDefault()}
        >
          <Sheen />
          {matches.length > 0 ? (
            <ul className="relative py-1.5">
              {matches.map((m) => (
                <li key={`${m.gameSlug}/${m.catSlug}`}>
                  <Link
                    href={`/${m.gameSlug}/${m.catSlug}`}
                    onClick={() => { setQ(''); setFocused(false) }}
                    className={`flex min-h-[44px] items-center gap-3 px-4 ${PRESSED}`}
                  >
                    <Search aria-hidden className="h-4 w-4 shrink-0 text-text-tertiary" />
                    <span className="min-w-0 flex-1 truncate text-[14px]">
                      <span className="font-semibold text-text-primary">{m.gameName}</span>
                      <span className="mx-1.5 text-text-disabled" aria-hidden>·</span>
                      <span className="text-text-secondary">{m.catLabel}</span>
                    </span>
                    <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-text-tertiary" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <button
              type="button"
              onClick={submit}
              className={`relative flex min-h-[48px] w-full items-center gap-3 px-4 text-left ${PRESSED}`}
            >
              <Search aria-hidden className="h-4 w-4 shrink-0 text-text-tertiary" />
              <span className="truncate text-[14px] text-text-secondary">
                Search for “<span className="font-semibold text-text-primary">{trimmed}</span>”
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   (1) HERO — headline, support line, search, category chips
   ──────────────────────────────────────────────────────────── */

/* Chips open the navbar's category sub-screen (app-like) rather than
   dumping everyone on the same /browse page — tabId matches NAV_TABS
   in navbar-floating.tsx, which listens for dm:open-category. */
const HERO_CHIPS = [
  { label: 'Currencies', Icon: Coins, tabId: 'currency' },
  { label: 'Items', Icon: Swords, tabId: 'items' },
  { label: 'Accounts', Icon: User, tabId: 'accounts' },
  { label: 'Boosting', Icon: Rocket, tabId: 'boosting' },
  { label: 'Top Ups', Icon: Zap, tabId: 'top-up' },
] as const

export function MobileHero() {
  return (
    <section className="relative z-10 px-5 pb-2 pt-7">
      <h1 className="t-hero text-text-primary">
        Game More.
        <br />
        {/* Forest → lime-whisper sweep on the second line only. */}
        <span className="bg-[linear-gradient(90deg,#3E9B63,#A3E635)] bg-clip-text text-transparent">
          Grind Less.
        </span>
      </h1>
      <p className="t-body mt-2.5 max-w-[34ch] text-text-secondary">
        Accounts, currency, items and boosts — every order covered by SafeDrop
        Buyer Protection.
      </p>

      <div className="mt-5">
        <MobileHeroSearch />
      </div>

      {/* Category chip slider — 5 tiles, scroll-snap, last one peeks. */}
      <div className="-mx-5 mt-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1 scrollbar-hide">
        {HERO_CHIPS.map(({ label, Icon, tabId }) => (
          <button
            key={label}
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('dm:open-category', { detail: tabId }),
              )
            }
            className={`relative flex h-[60px] min-w-[86px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[10px] ${RAISED} transition-colors active:bg-white/[0.07] ${PRESSED}`}
          >
            <Sheen />
            <Icon aria-hidden className="h-[18px] w-[18px] text-text-secondary" />
            <span className="text-[11px] font-semibold leading-none text-text-secondary">
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
    <div className="mt-2 flex flex-wrap gap-1">
      {shown.map((c) => (
        <Link
          key={c.slug}
          href={`/${game.slug}/${c.slug}`}
          className={`relative inline-flex h-6 max-w-full items-center overflow-hidden rounded px-2 ${RAISED} ${PRESSED}`}
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
      <MobileSectionHeader title="Popular Games" href="/browse" />
      <div className="flex snap-x gap-3 overflow-x-auto px-5 pb-1 scrollbar-hide">
        {games.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-[124px] shrink-0 snap-start">
                <div className={`aspect-[3/4] w-full animate-pulse rounded-xl ${RAISED}`} />
                <div className="mt-2 h-4 w-20 animate-pulse rounded bg-[rgba(20,36,26,0.8)]" />
              </div>
            ))
          : games.map((game) => (
              <div key={game.slug} className="w-[124px] shrink-0 snap-start">
                <SmartLink href={game.href} className={`block ${PRESSED}`}>
                  <div className={`relative aspect-[3/4] w-full overflow-hidden rounded-xl ${RAISED}`}>
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
                  <span className="t-card mt-2 block truncate px-0.5 text-text-primary">
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

const PROTECTION_STEPS = [
  { num: '01', title: 'Choose Your Item', copy: 'Compare offers, buy with confidence.', Icon: Step1ChooseItem, lit: true },
  { num: '02', title: 'Pay Securely', copy: 'Covered by SafeDrop from the first second.', Icon: Step2SecurePayment, lit: false },
  { num: '03', title: 'Get Your Delivery', copy: 'Fast in-game delivery, tracked live.', Icon: Step3Delivery, lit: false },
  { num: '04', title: 'Confirm Delivery', copy: 'Seller is paid after you confirm — or your money back.', Icon: Step4Confirm, lit: false },
] as const

export function MobileProtectionStrip() {
  return (
    <section className="relative z-10 pt-8">
      <MobileSectionHeader title="How You're Protected" href="/safedrop" linkLabel="SafeDrop" />
      <div className="-mb-1 flex snap-x gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
        {PROTECTION_STEPS.map(({ num, title, copy, Icon, lit }) => (
          <Link
            key={num}
            href="/safedrop"
            className={`relative min-w-[200px] shrink-0 snap-start overflow-hidden rounded-xl p-4 ${PRESSED} ${
              lit
                ? 'border border-[rgba(163,230,53,0.28)] bg-[linear-gradient(180deg,#16291D,#0E1611)] shadow-[0_10px_28px_rgba(0,0,0,0.35)]'
                : FOREST_GLASS
            }`}
          >
            <Sheen />
            <div className="flex items-start justify-between">
              {/* The shared 3D step icon — same art as the marketplace band */}
              <Icon className="h-11 w-11" />
              <span
                className={`t-eyebrow tabular-nums ${lit ? 'text-lime-text' : 'text-text-tertiary'}`}
              >
                Step {num}
              </span>
            </div>
            <span className="t-card mt-2.5 block text-text-primary">{title}</span>
            <span className="t-cap mt-1 block leading-snug text-text-secondary">{copy}</span>
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

export function MobileTrustRows() {
  return (
    <div className="flex flex-col gap-2.5">
      {TRUST_ROWS.map(({ claim, proof }) => (
        <div
          key={claim}
          className={`relative flex items-center gap-3 overflow-hidden rounded-xl p-3 ${FOREST_GLASS}`}
        >
          <Sheen />
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[rgba(163,230,53,0.16)] bg-[rgba(163,230,53,0.08)]"
          >
            <Check className="h-4 w-4 text-lime-text" strokeWidth={3} />
          </span>
          <span className="min-w-0 text-left">
            <span className="t-card block text-text-primary">{claim}</span>
            <span className="t-cap line-clamp-2 block text-text-tertiary">{proof}</span>
          </span>
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
      <div className="flex flex-col gap-2 px-5">
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
