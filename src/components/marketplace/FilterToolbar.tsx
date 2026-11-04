'use client'

/**
 * The listings toolbar (owner, 2026-11-03: "Clean Toolbar", picked from three
 * ideas, for the Items and listings pages): search, filters and sort on one
 * row on desktop, search + one Filters button below lg. Whatever is ticked
 * shows under it as removable chips. It scrolls with the page: only the navbar
 * stays on screen (owner, 2026-11-03).
 */
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { IconX } from '@tabler/icons-react'
import { Search } from 'lucide-react'
import { FiltersSheet, type FilterSheetSection } from './FiltersSheet'

export interface AppliedFilter {
  key: string
  label: string
  /** A badge before the label (Adopt Me's trait marks). */
  lead?: ReactNode
  onRemove: () => void
}

export function FilterToolbar({
  search,
  filters,
  sort,
  sections,
  applied,
  onClearFilters,
}: {
  search: { value: string; onChange: (v: string) => void; placeholder: string; ariaLabel: string }
  /** Desktop: the filter dropdowns. */
  filters: ReactNode
  /** Desktop: the sort dropdown, set apart from the filters. */
  sort: ReactNode
  /** Below lg: everything in the Filters sheet. */
  sections: FilterSheetSection[]
  applied: AppliedFilter[]
  onClearFilters: () => void
}) {
  const reduce = useReducedMotion()

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-2 [--h-btn-secondary:44px] [--h-input:44px] sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            aria-label={search.ariaLabel}
            className="w-full appearance-none rounded-lg bg-[#2E2F36] pl-10 pr-3 text-[16px] text-text-primary outline-none transition-colors placeholder:text-text-secondary hover:bg-[#33343B] focus:bg-[#33343B] focus-visible:shadow-none lg:text-[length:var(--fs-body)] [&::-webkit-search-cancel-button]:appearance-none"
            style={{ height: 'var(--h-input)' }}
          />
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          {filters}
          <span aria-hidden className="mx-1 h-6 w-px bg-white/[0.12]" />
          {sort}
        </div>

        <FiltersSheet sections={sections} active={applied.length} onClear={onClearFilters} className="lg:hidden" />
      </div>

      {applied.length > 0 && (
        <div className="-mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          <AnimatePresence initial={false} mode="popLayout">
            {applied.map((f) => (
              <motion.button
                key={f.key}
                layout={!reduce}
                type="button"
                onClick={f.onRemove}
                aria-label={`Remove ${f.label} filter`}
                initial={reduce ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.94, transition: { duration: 0.12 } }}
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-[rgba(106,168,255,0.14)] pl-2.5 pr-2 text-[13px] font-semibold text-text-primary transition-colors hover:bg-[rgba(106,168,255,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {f.lead}
                {f.label}
                <IconX aria-hidden size={13} stroke={2.2} className="text-text-secondary" />
              </motion.button>
            ))}
          </AnimatePresence>
          <button type="button" onClick={onClearFilters} className="ml-1 shrink-0 whitespace-nowrap text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary">
            Clear All
          </button>
        </div>
      )}
    </div>
  )
}
