'use client'

/**
 * GameSubNav — the game's second bar under the main navbar.
 *
 * Desktop (owner, 2026-10-26, GameBoost as the reference): a full-width strip
 * one step lighter than the navbar — game lockup left, category tabs centred
 * (icon + label, full bar height), the content tab right. Phones keep the
 * scrollable strip under the 60px app bar — except inside a listing
 * (`phoneBack`): there phones get a back button and the game name in the
 * navbar's own colour, so the two bars read as one section (owner, 2026-11-02/03,
 * Eldorado's phone item page as the reference). Fixed under the navbar; it slides
 * away on scroll down and returns on a small scroll up (owner, 2026-11-04,
 * GameBoost), except a phone's back row, which stays. Items is the first tab in
 * every game (owner, 2026-11-05).
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from '@/components/navigation/AppLink'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getGameIcon } from '@/features/home/lib/game-icons'
import { SubnavSellButton } from '@/components/seller/SellerPrompt'
import { useHideOnScroll } from '@/hooks/useHideOnScroll'
import { BackButton } from './BackButton'
import {
  SUBNAV_BG,
  SUBNAV_HIDDEN,
  SUBNAV_HIDDEN_MD,
  SUBNAV_LOGO,
  SUBNAV_NAME,
  SUBNAV_ROW,
  SUBNAV_SLOT,
  SUBNAV_STRIP,
  SUBNAV_TAB,
  SUBNAV_TAB_ACTIVE,
  SubnavActiveBar,
  categoryIcon,
  itemsFirst,
  subnavIconClass,
} from './subnav-tab'
import { pictureUrl } from '@/lib/images/picture-url'

export interface GameCategory {
  id: string
  name: string
  slug: string
  /** game_categories.type (currency|items|account|…): picks the tab icon. */
  type?: string | null
  icon_emoji?: string | null
  icon_url?: string | null
  icon_type?: 'emoji' | 'image' | 'svg' | null
}

interface GameSubNavProps {
  gameSlug: string
  gameName: string
  gameImageUrl?: string | null
  currentCategorySlug: string
  categories: GameCategory[]
  /**
   * Optional extra tab links rendered after the category strip (separated by a
   * divider). Used by the Steal a Brainrot landing to surface the Values /
   * Calculator tools alongside the marketplace categories. The caller supplies
   * ready-made link nodes (e.g. SwooshLinks) so this shared component stays
   * game-agnostic.
   */
  extraTabs?: React.ReactNode
  /**
   * Inside a listing (the pet page): phones swap the tab strip for a back
   * button + the game name. `href` is where Back goes when there is no
   * earlier page of ours to return to (opened from a search result).
   */
  phoneBack?: { href: string }
}

export default function GameSubNav({
  gameSlug,
  gameName,
  gameImageUrl,
  currentCategorySlug,
  categories,
  extraTabs,
  phoneBack,
}: GameSubNavProps) {
  const router = useRouter()
  const scrollHidden = useHideOnScroll()
  // V14m — Track which tab is mid-navigation so we can show a small spinner
  // on it (instead of the whole UI sitting silent until the new page paints).
  const [isPendingNav, startNavTransition] = useTransition()
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)
  // V14s — Spinner-visibility gate. Cached/instant navigations resolve in
  // under a frame; flashing a spinner for ~100ms reads as glitchy. We only
  // reveal the spinner after a short delay so quick transitions stay clean
  // and only the genuinely slow ones get the loading state.
  const [spinnerVisible, setSpinnerVisible] = useState(false)
  const spinnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isPendingNav && pendingSlug) {
      // V14u — Arm the spinner only after 350ms. Cached / fast routes resolve
      // in 50-300ms; flashing a spinner for sub-second navs reads as glitchy.
      // We only reveal the spinner for genuinely slow transitions (>350ms).
      spinnerTimerRef.current = setTimeout(() => setSpinnerVisible(true), 350)
    } else {
      // Nav finished (or never started): cancel pending reveal and hide.
      if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current)
      setSpinnerVisible(false)
      if (!isPendingNav) setPendingSlug(null)
    }
    return () => {
      if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current)
    }
  }, [isPendingNav, pendingSlug])

  // V17g — Alias rewrite removed. DB stores canonical slugs directly
  // so the slug we receive is already the final URL slug.
  const goToCategory = (slug: string) => {
    if (slug === currentCategorySlug) return
    setPendingSlug(slug)
    startNavTransition(() => {
      router.push(`/${gameSlug}/${slug}`)
    })
  }

  // Keep the game lockup present even when a database row has no artwork yet.
  // The shared registry mirrors the homepage fallback icons and avoids a
  // broken/empty left edge in the compact mobile subnavbar.
  const resolvedGameImage = gameImageUrl || getGameIcon(gameSlug)

  // Tell the navbar a sub-navbar is mounted, so it drops its bottom hairline
  // and edge line and the two bars read as one block (any route: hub,
  // category, listing).
  useEffect(() => {
    const root = document.documentElement
    root.dataset.subnav = '1'
    return () => {
      delete root.dataset.subnav
    }
  }, [])

  return (
    /* A full-width strip fixed flush under the navbar; the slot holds its place in the page. */
    <nav aria-label={`${gameName} categories`} className={SUBNAV_SLOT}>
      <div
        className={cn(SUBNAV_STRIP, phoneBack && 'max-md:shadow-none', scrollHidden && (phoneBack ? SUBNAV_HIDDEN_MD : SUBNAV_HIDDEN))}
        style={{ backgroundColor: SUBNAV_BG }}
      >
        {phoneBack ? (
          <div className="flex w-full items-center md:hidden">
            <BackButton href={phoneBack.href} className="bg-white/[0.06] hover:bg-white/[0.1]">
              <ChevronLeft aria-hidden className="h-5 w-5" />
            </BackButton>
            <Link href={`/${gameSlug}`} className="min-w-0 flex-1 truncate px-2 text-center text-[15px] font-bold text-text-primary">
              {gameName}
            </Link>
            <span aria-hidden className="w-11 shrink-0" />
          </div>
        ) : null}
        <div className={cn(SUBNAV_ROW, phoneBack && 'max-md:hidden')}>
          {/* ── Game name / logo ───────────────────────────────────────── */}
          <Link
            href={`/${gameSlug}`}
            className="group flex min-w-0 flex-shrink-0 items-center gap-2.5 justify-self-start rounded-md px-2.5 py-2 transition-colors hover:bg-bg-raised-hover md:gap-3 md:px-0 md:hover:bg-transparent max-md:max-w-[42%] max-md:gap-1.5 max-md:px-1.5 max-md:py-1"
          >
            <img
              src={pictureUrl(resolvedGameImage, 'thumb')}
              alt={gameName}
              className={cn(SUBNAV_LOGO, 'object-contain opacity-95')}
            />
            <span className={cn(SUBNAV_NAME, 'truncate text-gray-100 transition-colors group-hover:text-text-primary')}>
              {gameName}
            </span>
          </Link>

          {/* ── Divider (phones only: desktop centres the tabs instead) ── */}
          <div className="mx-1 h-4 w-px shrink-0 bg-white/[0.12] md:hidden" />

          {/* ── Category tabs ──────────────────────────────────────────── */}
          {categories.length === 0 ? (
            <Link
              href="/"
              className="flex items-center gap-1 justify-self-center rounded-md px-3 py-2.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Marketplace
            </Link>
          ) : (
            /* Relative wrapper so a right-edge fade can sit over the
               scrollable strip on phones (the scrollbar is hidden). */
            <div className="relative min-w-0 max-md:flex-1 md:justify-self-center">
              <div
                className="flex items-center overflow-x-auto max-md:gap-1 md:overflow-visible"
                style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
              >
                {itemsFirst(categories).map((cat) => {
                  const isActive = cat.slug === currentCategorySlug
                  const isPending = pendingSlug === cat.slug
                  // V14s — the spinner only after the grace period.
                  const showLoading = isPending && spinnerVisible
                  const Icon = categoryIcon(cat)

                  return (
                    // A real link, not a button (crawl audit 2026-10-23): this
                    // strip is on every game landing, category and listing page.
                    // A plain click keeps the transition + delayed spinner;
                    // new-tab and modifier clicks are left to the browser.
                    <Link
                      key={cat.id}
                      href={`/${gameSlug}/${cat.slug}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                        e.preventDefault()
                        if (!isPending) goToCategory(cat.slug)
                      }}
                      aria-disabled={isPending || undefined}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(SUBNAV_TAB, isActive && SUBNAV_TAB_ACTIVE, isPending && 'cursor-wait')}
                    >
                      {isActive && <SubnavActiveBar />}
                      {showLoading ? (
                        <Loader2 aria-hidden className="relative z-10 h-[17px] w-[17px] animate-spin text-white/70" />
                      ) : (
                        <Icon aria-hidden stroke={1.9} className={subnavIconClass(isActive)} />
                      )}
                      <span className="relative z-10">{cat.name}</span>
                    </Link>
                  )
                })}
                {/* Phones: the content tab joins the strip behind a hairline. */}
                {extraTabs && (
                  <span className="contents md:hidden">
                    <span className="mx-1 h-4 w-px shrink-0 bg-white/[0.12]" />
                    {extraTabs}
                  </span>
                )}
              </div>
              {/* Right-edge fade — overflow affordance, phones only */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-[#16171B] to-transparent md:hidden"
              />
            </div>
          )}

          {/* ── Content tab + Sell (desktop: right column). Sell from lg
                 up: below that the strip is full, and listings carry a Sell row
                 in their grid instead. ─────────────────────────────────── */}
          <div className="hidden items-center gap-3 justify-self-end md:flex">
            {extraTabs}
            <SubnavSellButton className="max-lg:hidden" />
          </div>
        </div>
      </div>
    </nav>
  )
}
