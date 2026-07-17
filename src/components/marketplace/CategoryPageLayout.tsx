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

  // Mobile-audit — the toggle is built once and rendered in two spots:
  // inline (sm+, original single-row layout) and inside SearchAndSort's
  // mobile second row, where it shares the line with the sort select so
  // the search input can take a full-width line of its own at 360px.
  const filtersButton = (
    <button
      onClick={() => setFilterOpen((v) => !v)}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors',
        filterOpen
          ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
          : 'border-border-default bg-bg-raised text-text-primary hover:border-lime-tint-border hover:bg-bg-raised-hover',
      )}
      aria-pressed={filterOpen}
    >
      {filterOpen ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
      <span>Filters</span>
    </button>
  )

  return (
    <div>
      {/* ── Top bar: filter toggle + search/sort ─────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="hidden shrink-0 sm:block">{filtersButton}</div>

        <div className="flex-1 min-w-0">
          <SearchAndSort filtersSlot={filtersButton} />
        </div>
      </div>

      {/* ── Listing count ─────────────────────────────────────────────── */}
      <p className="mb-4 text-sm text-text-tertiary">
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
                <div className="h-full border-r border-border-default bg-bg-raised p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-text-primary">Filters</span>
                    <button
                      onClick={() => setFilterOpen(false)}
                      className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-raised-hover hover:text-text-primary"
                      aria-label="Close filters"
                    >
                      <X className="h-4 w-4" />
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
