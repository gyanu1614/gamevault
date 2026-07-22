'use client'

/**
 * GameSubNav — floating pill sub-navbar, same shape as the main navbar.
 *
 * Centered below the main navbar with a small gap.
 * Sticky so it stays visible while scrolling the category page.
 * Active tab gets a subtle highlight; Framer Motion animates between them.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getGameIcon } from '@/features/home/lib/game-icons'
import { useScrollDirection } from '@/hooks/useScrollDirection'

export interface GameCategory {
  id: string
  name: string
  slug: string
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
}

export default function GameSubNav({
  gameSlug,
  gameName,
  gameImageUrl,
  currentCategorySlug,
  categories,
}: GameSubNavProps) {
  const router = useRouter()
  // Hide-on-scroll: slides up with the primary navbar (shared signal).
  const { hidden: scrollHidden } = useScrollDirection({ revealAt: 40 })
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

  return (
    /* Desktop keeps the original floating pill. On phones this same
       component becomes the page-local subnavbar: the outer slot reserves
       the fixed bar's real height (58px measured) so content below never
       overlaps, while the inner row stays attached directly beneath the
       fixed 60px primary header. */
    <nav
      aria-label={`${gameName} categories`}
      className="relative z-40 flex justify-center px-3 py-3 pointer-events-none sm:py-4 md:py-5 max-md:h-[58px] max-md:px-0 max-md:py-0"
    >
      <motion.div
        initial={false}
        /* Slide up in lockstep with the primary navbar on scroll-down
           (mobile only — the y transform is harmless on desktop where the
           bar isn't fixed). */
        animate={{ y: scrollHidden ? '-120%' : '0%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.8 }}
        className={cn(
          'pointer-events-auto w-full max-w-fit',
          'flex items-center gap-0.5',
          // V21/P7.k — Match the floating navbar: translucent dark
          // surface + heavy blur so the hero/gradient bleeds through
          // instead of a flat black pill. Inline rgba because our
          // tokens are raw hex (Tailwind /opacity doesn't apply).
          'rounded-full border border-white/[0.1] shadow-2xl backdrop-blur-2xl backdrop-saturate-150',
          // Mobile-audit — wrapper py trimmed (1.5 -> 1) to offset the
          // taller tab buttons below (py-1 -> py-2.5 for >=36px targets)
          // so the pill's overall height barely grows.
          'px-2 py-1 sm:px-2.5 sm:py-2',
          'max-md:fixed max-md:inset-x-0 max-md:top-[60px] max-md:z-[45] max-md:max-w-none max-md:!rounded-none max-md:!border-x-0 max-md:!border-t-0 max-md:border-b max-md:border-white/[0.08] max-md:px-2 max-md:py-2 max-md:!bg-[#0b0f0c]',
        )}
        style={{ backgroundColor: 'rgba(28, 28, 37, 0.30)' }}
      >
        {/* ── Game name / logo ───────────────────────────────────────── */}
        <Link
          href={`/${gameSlug}`}
          className="group flex flex-shrink-0 items-center gap-2 rounded-full px-2.5 py-2 transition-colors hover:bg-bg-raised-hover sm:px-3.5 sm:py-1.5 max-md:max-w-[42%] max-md:gap-1.5 max-md:px-1.5 max-md:py-1"
        >
          <img
            src={resolvedGameImage}
            alt={gameName}
            className="h-5 w-5 rounded-md object-contain opacity-95 sm:h-[26px] sm:w-[26px]"
          />
          <span className="truncate text-[13px] font-bold tracking-tight text-gray-200 transition-colors group-hover:text-text-primary sm:text-[14.5px]">
            {gameName}
          </span>
        </Link>

        {/* ── Divider ────────────────────────────────────────────────── */}
        <div className="h-4 w-px shrink-0 bg-white/[0.12] sm:mx-1.5 sm:h-5 max-md:mx-1" />

        {/* ── Category tabs ──────────────────────────────────────────── */}
        {categories.length === 0 ? (
          <Link
            href="/"
            className="flex items-center gap-1 rounded-full px-2.5 py-2.5 sm:px-3 sm:py-1.5 text-xs sm:text-sm text-text-secondary hover:text-text-primary hover:bg-bg-raised-hover transition-colors"
          >
            <ChevronLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            Marketplace
          </Link>
        ) : (
          /* Mobile-audit — relative wrapper so a right-edge fade can sit
             over the scrollable tab strip, signalling more tabs off-screen
             on phones (the scrollbar is hidden). */
          <div className="relative min-w-0 max-md:flex-1">
            <div
              className="flex items-center gap-0.5 overflow-x-auto max-md:gap-1"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            >
            {categories.map((cat) => {
              const isActive = cat.slug === currentCategorySlug
              // V17g — Slug is the slug; no alias indirection anymore.
              const isPending = pendingSlug === cat.slug
              // V14s — Only swap to the spinner / lime tint after the
              // 150ms grace period. Sub-150ms navs stay clean — no flash.
              const showLoading = isPending && spinnerVisible
              const showIcon = cat.icon_type === 'image' || cat.icon_type === 'svg'
              const icon = showIcon && cat.icon_url ? cat.icon_url : cat.icon_emoji

              return (
                <button
                  key={cat.id}
                  onClick={() => goToCategory(cat.slug)}
                  disabled={isPending}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    // Underline style — no pill. Chunkier on mobile (py-2.5,
                    // 13px) so the strip doesn't read thin; desktop keeps its
                    // tighter rhythm.
                    'relative flex-shrink-0 flex items-center gap-1.5 rounded-md px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors sm:px-3.5 sm:py-2 sm:text-[13.5px] max-md:px-3 max-md:py-2.5',
                    isActive
                      ? 'text-white'
                      : 'text-text-secondary hover:text-gray-100',
                    isPending && 'cursor-wait'
                  )}
                >
                  {(isActive || showLoading) && (
                    <motion.span
                      layoutId="activeCategory"
                      className="absolute inset-x-1.5 bottom-0 h-[2.5px] rounded-full bg-[#3f9d5a] shadow-[0_0_10px_rgba(63,157,90,0.55)]"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  {/* V14m — Swap the leading icon for a spinner while the
                      target page is loading. V14s — only after 150ms so
                      cached/instant navs don't flash. */}
                  {showLoading ? (
                    <Loader2 className="relative z-10 h-4 w-4 animate-spin text-lime-text" />
                  ) : icon ? (
                    <span className="relative z-10">
                      {showIcon ? (
                        <img
                          src={icon}
                          alt={cat.name}
                          className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded object-cover"
                        />
                      ) : (
                        <span className="text-sm">{icon}</span>
                      )}
                    </span>
                  ) : null}
                  <span className={cn(
                    'relative z-10',
                    showLoading && 'text-lime-text'
                  )}>{cat.name}</span>
                </button>
              )
            })}
            </div>
            {/* Right-edge fade — overflow affordance, phones only */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-5 rounded-r-full bg-gradient-to-l from-black/35 to-transparent sm:hidden"
            />
          </div>
        )}
      </motion.div>
    </nav>
  )
}
