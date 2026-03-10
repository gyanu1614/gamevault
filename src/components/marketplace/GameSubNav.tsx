'use client'

/**
 * GameSubNav — floating pill sub-navbar, same shape as the main navbar.
 *
 * Centered below the main navbar with a small gap.
 * Sticky so it stays visible while scrolling the category page.
 * Active tab gets a subtle highlight; Framer Motion animates between them.
 */

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface GameCategory {
  id: string
  name: string
  slug: string
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

  return (
    /* Sticky container — sits right below the fixed main navbar (top-[72px])
       py-10 on desktop / py-6 on mobile gives a balanced gap */
    <div className="sticky top-[72px] z-40 flex justify-center py-6 sm:py-8 md:py-10 pointer-events-none bg-black px-3">
      <div
        className={cn(
          'pointer-events-auto w-full max-w-fit',
          'flex items-center gap-0.5',
          'rounded-full border border-white/[0.1] bg-black shadow-2xl backdrop-blur-xl',
          'px-2 py-2 sm:px-3 sm:py-2.5',
        )}
      >
        {/* ── Game name / logo ───────────────────────────────────────── */}
        <Link
          href={`/${gameSlug}`}
          className="group flex items-center gap-2 flex-shrink-0 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 transition-colors hover:bg-white/[0.06]"
        >
          {gameImageUrl ? (
            <img
              src={gameImageUrl}
              alt={gameName}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-md object-contain opacity-95"
            />
          ) : null}
          <span className="text-sm sm:text-[15px] font-bold text-gray-200 group-hover:text-white transition-colors whitespace-nowrap tracking-tight">
            {gameName}
          </span>
        </Link>

        {/* ── Divider ────────────────────────────────────────────────── */}
        <div className="w-px h-4 sm:h-5 bg-white/[0.12] flex-shrink-0 mx-1 sm:mx-1.5" />

        {/* ── Category tabs ──────────────────────────────────────────── */}
        {categories.length === 0 ? (
          <Link
            href="/"
            className="flex items-center gap-1 rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
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
              return (
                <button
                  key={cat.id}
                  onClick={() => router.push(`/${gameSlug}/${cat.slug}`)}
                  className={cn(
                    'relative flex-shrink-0 px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap rounded-full transition-colors',
                    isActive
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-white/[0.05]'
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="activeCategory"
                      className="absolute inset-0 rounded-full bg-white/[0.1]"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{cat.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
