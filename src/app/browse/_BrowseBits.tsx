'use client'

/** /browse listing grid's small pieces: a filter chip, the empty state, the loading skeleton. */

import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { PackageIcon } from '@phosphor-icons/react/dist/csr/Package'
import { ListingCardSkeleton } from '@/components/listing-card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MARKET_CARD } from '@/lib/ui/surfaces'

export function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-md bg-white/[0.06] pl-2.5 pr-1 text-[12.5px] font-medium text-text-secondary">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded p-0.5 text-text-tertiary transition-colors hover:bg-bg-raised-hover hover:text-text-primary"
        aria-label={`Remove filter ${label}`}
      >
        <XIcon size={12} weight="bold" />
      </button>
    </span>
  )
}

export function EmptyState({ onClear, hasActiveFilters }: { onClear: () => void; hasActiveFilters: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-lg p-10 text-center', MARKET_CARD)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05]">
        <PackageIcon size={22} weight="duotone" aria-hidden className="text-text-tertiary" />
      </div>
      <div>
        <h3 className="text-body font-semibold text-text-primary">No Listings Match</h3>
        <p className="mt-1 text-body-sm text-text-secondary">
          Try another game, a wider price range or a shorter search.
        </p>
      </div>
      {hasActiveFilters && (
        <Button
          variant="outline"
          onClick={onClear}
          className="rounded-md border-0 bg-white/[0.07] text-text-primary hover:bg-white/[0.11]"
        >
          Clear All Filters
        </Button>
      )}
    </div>
  )
}

export function BrowseLoadingFallback() {
  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="h-11 flex-1 animate-pulse rounded-md bg-bg-raised" />
        <div className="h-11 w-52 animate-pulse rounded-md bg-bg-raised" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
