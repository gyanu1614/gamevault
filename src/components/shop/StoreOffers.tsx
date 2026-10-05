'use client'

/**
 * Storefront offers: game + category + sort dropdowns and a search box over
 * the shared marketplace ItemCard (the same card as the category pages —
 * never a shop-local copy), paged with Load More.
 *
 * Controls are the items page's own (`SingleSelectFilter` + the phone filter
 * bar in a ScrollRow), so the shop reads as part of the marketplace and the
 * row scrolls inside its frame on phones instead of the page scrolling
 * sideways.
 */

import { useMemo, useState } from 'react'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { PackageIcon } from '@phosphor-icons/react/dist/csr/Package'
import ItemCard from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemCard'
import { currencyOfferUrl, isCurrencyCategoryType } from '@/lib/listings/url'
import { SingleSelectFilter, iconForFilter } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemFilters'
import { ScrollRow } from '@/components/ui/scroll-row'
import { useAuth } from '@/hooks/use-auth'
import {
  ALL,
  DEFAULT_STORE_FILTERS,
  categoryFacets,
  filterStoreOffers,
  gameFacets,
  reconcileFilters,
  storeSortOptions,
  type StoreFilters,
  type StoreOffer,
  type StoreSort,
} from '@/lib/shop/storefront-model'

const PAGE_SIZE = 24

export function StoreOffers({
  offers,
  sellerName,
  shopSlug,
}: {
  offers: StoreOffer[]
  sellerName: string
  /** The store's seller, so currency offers link straight to the currency page with them selected. */
  shopSlug: string | null
}) {
  const [rawFilters, setFilters] = useState<StoreFilters>(DEFAULT_STORE_FILTERS)
  const [pages, setPages] = useState(1)
  const { user } = useAuth()
  const viewerId = user?.id ?? null

  const filters = useMemo(() => reconcileFilters(offers, rawFilters), [offers, rawFilters])
  const games = useMemo(() => gameFacets(offers), [offers])
  const categories = useMemo(() => categoryFacets(offers, filters.game), [offers, filters.game])
  const sortOptions = useMemo(() => storeSortOptions(offers), [offers])
  const results = useMemo(() => filterStoreOffers(offers, filters), [offers, filters])
  const visible = results.slice(0, pages * PAGE_SIZE)

  const update = (patch: Partial<StoreFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPages(1)
  }
  const isFiltered = filters.game !== ALL || filters.category !== ALL || filters.q.trim() !== ''

  if (offers.length === 0) {
    return (
      <EmptyState
        title="No Offers Yet"
        body={`${sellerName} has nothing listed right now. Check back soon.`}
      />
    )
  }

  const gameOptions = [
    { slug: ALL, label: 'All Games' },
    ...games.map((g) => ({ slug: g.slug, label: `${g.label} (${g.count})` })),
  ]
  const categoryOptions = [
    { slug: ALL, label: 'All Categories' },
    ...categories.map((c) => ({ slug: c.slug, label: `${c.label} (${c.count})` })),
  ]

  return (
    <div>
      {/* Filter band — same sizing tokens as the items page. */}
      <div className="[--h-btn-secondary:40px] [--h-input:40px] sm:[--h-btn-secondary:42px] sm:[--h-input:42px]">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="max-sm:w-fit max-sm:max-w-full max-sm:overflow-hidden max-sm:rounded-lg max-sm:border max-sm:border-white/[0.08] max-sm:bg-bg-well max-sm:[--h-btn-secondary:34px]">
            <ScrollRow
              edgeColor="var(--color-bg-well)"
              className="flex items-center overflow-x-auto [scrollbar-width:none] max-sm:w-max max-sm:max-w-full max-sm:gap-0.5 max-sm:p-0.5 sm:flex-wrap sm:gap-2 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
            >
              {games.length > 1 && (
                <SingleSelectFilter
                  title="Game"
                  icon={iconForFilter('type')}
                  options={gameOptions}
                  value={filters.game}
                  onChange={(game) => update({ game, category: ALL })}
                />
              )}
              {categories.length > 1 && (
                <SingleSelectFilter
                  title="Category"
                  icon={iconForFilter('category')}
                  options={categoryOptions}
                  value={filters.category}
                  onChange={(category) => update({ category })}
                />
              )}
              <SingleSelectFilter<StoreSort>
                title="Sort By"
                options={sortOptions}
                value={filters.sort}
                onChange={(sort) => update({ sort })}
              />
            </ScrollRow>
          </div>

          <div className="relative w-full lg:ml-auto lg:max-w-sm">
            <MagnifyingGlassIcon
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="Search This Shop"
              aria-label="Search this shop's offers"
              className="w-full appearance-none rounded-lg border border-white/[0.08] bg-bg-well pl-10 pr-3 text-[16px] text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-white/[0.14] focus:border-focus-border focus-visible:shadow-none sm:text-[length:var(--fs-body)] [&::-webkit-search-cancel-button]:appearance-none"
              style={{ height: 'var(--h-input)' }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-[13px] text-text-tertiary">
        <span aria-live="polite">
          {results.length === offers.length
            ? `${offers.length} ${offers.length === 1 ? 'Offer' : 'Offers'}`
            : `${results.length} of ${offers.length} Offers`}
        </span>
        {isFiltered && (
          <button
            type="button"
            onClick={() => update({ game: ALL, category: ALL, q: '' })}
            className="rounded font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Clear Filters
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No Offers Match"
            body="Try another game, category or search."
            action={
              <button
                type="button"
                onClick={() => update({ game: ALL, category: ALL, q: '' })}
                className="inline-flex h-10 items-center justify-center rounded-md bg-white/[0.07] px-4 text-[13px] font-semibold text-text-primary transition-colors hover:bg-white/[0.11]"
              >
                Clear Filters
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" style={{ gap: 'var(--gap-grid)' }}>
            {visible.map((o) => (
              <ItemCard
                key={o.offer.id}
                offer={o.offer}
                gameSlug={o.game.slug}
                gameName={o.game.name}
                isOwn={!!viewerId && o.offer.sellerId === viewerId}
                href={
                  isCurrencyCategoryType(o.category.type)
                    ? currencyOfferUrl({
                        gameSlug: o.game.slug,
                        categorySlug: o.category.slug,
                        listingId: o.offer.id,
                        sellerSlug: shopSlug,
                      })
                    : undefined
                }
              />
            ))}
          </div>
          {visible.length < results.length && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setPages((p) => p + 1)}
                className="inline-flex items-center gap-2 rounded-md bg-bg-raised px-6 text-[13px] font-semibold text-text-primary transition-colors hover:bg-bg-raised-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                style={{ minHeight: 'var(--h-btn-primary)' }}
              >
                Load More Offers
                <span aria-hidden className="text-text-tertiary">·</span>
                <span className="tabular-nums text-text-tertiary">{results.length - visible.length} left</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-bg-raised px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.05] text-text-secondary">
        <PackageIcon size={20} aria-hidden />
      </div>
      <h3 className="text-[16px] font-semibold text-text-primary">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-text-secondary">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
