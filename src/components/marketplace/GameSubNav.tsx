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

  return (
    /* V14f — Non-sticky. Scrolls away with the rest of the page so the
       viewport opens up as the user moves down.
       V19/P24/P7.o — Outer wrapper bg removed so the body's violet
       gradient bleeds through. The inner pill keeps its own opaque
       bg + blur so it stays readable on top of the gradient. */
    <div className="relative z-40 flex justify-center py-6 sm:py-8 md:py-10 pointer-events-none px-3">
      <div
        className={cn(
          'pointer-events-auto w-full max-w-fit',
          'flex items-center gap-0.5',
          // V21/P7.k — Match the floating navbar: translucent dark
          // surface + heavy blur so the hero/gradient bleeds through
          // instead of a flat black pill. Inline rgba because our
          // tokens are raw hex (Tailwind /opacity doesn't apply).
          'rounded-full border border-white/[0.1] shadow-2xl backdrop-blur-2xl backdrop-saturate-150',
          'px-2 py-2 sm:px-3 sm:py-2.5',
        )}
        style={{ backgroundColor: 'rgba(28, 28, 37, 0.30)' }}
      >
        {/* ── Game name / logo ───────────────────────────────────────── */}
        <Link
          href={`/${gameSlug}`}
          className="group flex items-center gap-2 flex-shrink-0 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 transition-colors hover:bg-bg-raised-hover"
        >
          {gameImageUrl ? (
            <img
              src={gameImageUrl}
              alt={gameName}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-md object-contain opacity-95"
            />
          ) : null}
          <span className="text-sm sm:text-[15px] font-bold text-gray-200 group-hover:text-text-primary transition-colors whitespace-nowrap tracking-tight">
            {gameName}
          </span>
        </Link>

        {/* ── Divider ────────────────────────────────────────────────── */}
        <div className="w-px h-4 sm:h-5 bg-white/[0.12] flex-shrink-0 mx-1 sm:mx-1.5" />

        {/* ── Category tabs ──────────────────────────────────────────── */}
        {categories.length === 0 ? (
          <Link
            href="/"
            className="flex items-center gap-1 rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm text-text-secondary hover:text-text-primary hover:bg-bg-raised-hover transition-colors"
          >
            <ChevronLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            Marketplace
          </Link>
        ) : (
          <div
            className="flex items-center gap-0.5 overflow-x-auto"
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
                  className={cn(
                    'relative flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap rounded-full transition-colors',
                    isActive
                      ? 'text-text-primary'
                      : 'text-text-secondary hover:text-gray-100 hover:bg-bg-overlay',
                    isPending && 'cursor-wait'
                  )}
                >
                  {(isActive || showLoading) && (
                    <motion.span
                      layoutId="activeCategory"
                      className={cn(
                        'absolute inset-0 rounded-full',
                        showLoading ? 'bg-lime-tint-bg/40' : 'bg-white/[0.1]'
                      )}
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
        )}
      </div>
    </div>
  )
}
