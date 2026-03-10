'use client'

/**
 * CategoryPageLayout — client wrapper that manages the collapsible filter sidebar.
 *
 * Desktop: filter panel slides in from the left, pushing content right.
 * Mobile:  filter panel overlays from the left as a drawer.
 * Uses Framer Motion AnimatePresence for smooth enter/exit.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import FiltersSidebar from './FiltersSidebar'
import SearchAndSort from './SearchAndSort'
import LoadMoreListings from './LoadMoreListings'

interface CategoryPageLayoutProps {
  maxPrice: number
  totalListings: number
  hasMore: boolean
  currentPage: number
  children: React.ReactNode
}

export default function CategoryPageLayout({
  maxPrice,
  totalListings,
  hasMore,
  currentPage,
  children,
}: CategoryPageLayoutProps) {
  const [filterOpen, setFilterOpen] = useState(false)

  const roundedMax = Math.ceil(maxPrice / 100) * 100

  return (
    <div>
      {/* ── Top bar: filter toggle + search/sort ─────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => setFilterOpen((v) => !v)}
          className={cn(
            'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border',
            filterOpen
              ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
              : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.07]'
          )}
        >
          {filterOpen ? (
            <X className="w-4 h-4" />
          ) : (
            <SlidersHorizontal className="w-4 h-4" />
          )}
          <span>Filters</span>
        </button>

        <div className="flex-1">
          <SearchAndSort />
        </div>
      </div>

      {/* ── Listing count ─────────────────────────────────────────────── */}
      <p className="mb-4 text-sm text-zinc-500">
        {totalListings} {totalListings === 1 ? 'listing' : 'listings'} found
      </p>

      {/* ── Layout: sidebar + content ─────────────────────────────────── */}
      <div className="flex gap-5">
        {/* ── Desktop: inline sidebar ─────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {filterOpen && (
            <motion.div
              key="desktop-sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 268, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 36 }}
              className="hidden md:block flex-shrink-0 overflow-hidden"
            >
              <div className="w-[268px]">
                <FiltersSidebar maxPrice={roundedMax} inline />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Mobile: overlay drawer ────────────────────────────────────── */}
        <AnimatePresence>
          {filterOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                key="mobile-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
                onClick={() => setFilterOpen(false)}
              />
              {/* Drawer */}
              <motion.div
                key="mobile-drawer"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 36 }}
                className="md:hidden fixed inset-y-0 left-0 z-50 w-80 overflow-y-auto"
              >
                <div className="p-5 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-white">Filters</span>
                    <button
                      onClick={() => setFilterOpen(false)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <FiltersSidebar maxPrice={roundedMax} inline />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Content area (animates width when sidebar opens) ─────────── */}
        <motion.div layout="size" className="flex-1 min-w-0">
          {children}
          <LoadMoreListings
            currentPage={currentPage}
            hasMore={hasMore}
            listingsPerPage={12}
          />
        </motion.div>
      </div>
    </div>
  )
}
