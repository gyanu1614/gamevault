'use client'

/**
 * The Items page on a values game (owner, 2026-10-24): one card per catalogue
 * item (GridCard, design C) instead of one per listing. Same page frame as the
 * listings view (CategoryHeader, the filter bar, the search row, Pagination),
 * so the two never look different. Filters, sort and search run on the client
 * over the full list; the page number lives in the URL (?page=), read through
 * SearchParamsBridge so the first page stays in the static HTML.
 */
import { useCallback, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { SearchParamsBridge } from '@/components/navigation/SearchParamsBridge'
import { ScrollRow } from '@/components/ui/scroll-row'
import { Pagination } from '@/components/marketplace/Pagination'
import { CategoryHeader } from '@/components/marketplace/CategoryHeader'
import { useUrlPage } from '@/hooks/use-url-page'
import { useAuth } from '@/hooks/use-auth'
import ItemCard from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemCard'
import { MultiSelectFilter, PriceRangeFilter, SingleSelectFilter, iconForFilter } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemFilters'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { filterGrid, sortGrid, type FilterOption, type GridItem, type GridSort } from './model/grid'
import { GridCard } from './GridCard'
import { StockAlertsProvider } from './stock-alerts-context'

const PAGE_SIZE = 24

const SORT_OPTIONS: { slug: GridSort; label: string }[] = [
  { slug: 'recommended', label: 'Recommended' },
  { slug: 'cheapest', label: 'Cheapest First' },
  { slug: 'priciest', label: 'Priciest First' },
]

const toTaxonomy = (xs: FilterOption[]) => xs.map((x) => ({ slug: x.value, label: x.label }))

export interface ItemsGridClientProps {
  gameSlug: string
  gameName: string
  gameImageUrl: string | null
  categoryLabel: string
  /** "Pets", "Brainrots", "Items": the search placeholder and the count. */
  itemNoun: string
  items: GridItem[]
  options: { rarities: FilterOption[]; types: FilterOption[]; forms: FilterOption[] }
  stats?: { count: number; lowPrice: number | null; avgDeliveryLabel: string | null } | null
  introLine?: string | null
  /** Live listings not linked to any catalogue item (bundles, odd titles). */
  moreListings: ItemOffer[]
}

export default function ItemsGridClient({ gameSlug, gameName, gameImageUrl, categoryLabel, itemNoun, items, options, stats, introLine, moreListings }: ItemsGridClientProps) {
  const { user } = useAuth()
  const [rarities, setRarities] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [forms, setForms] = useState<string[]>([])
  const [price, setPrice] = useState<[number, number] | null>(null)
  const [sort, setSort] = useState<GridSort>('recommended')
  const [q, setQ] = useState('')

  // A ?search= deep link (old value-page links) seeds the search once.
  const seedFromUrl = useCallback((params: URLSearchParams) => {
    const s = params.get('search')
    if (s) setQ((cur) => cur || s)
  }, [])

  const priceBounds = useMemo<[number, number]>(() => {
    const prices = items.map((i) => i.minPrice).filter((p): p is number => p != null)
    return prices.length > 0 ? [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))] : [0, 0]
  }, [items])

  const sorted = useMemo(
    () => sortGrid(filterGrid(items, { rarities, types, forms, minPrice: price?.[0] ?? null, maxPrice: price?.[1] ?? null, search: q }), sort),
    [items, rarities, types, forms, price, q, sort],
  )
  const filterKey = [rarities.join(','), types.join(','), forms.join(','), price?.join('-') ?? '', q.trim(), sort].join('|')
  const paged = useUrlPage(sorted, PAGE_SIZE, filterKey)

  const clear = () => {
    setRarities([])
    setTypes([])
    setForms([])
    setPrice(null)
    setQ('')
  }

  return (
    <StockAlertsProvider gameSlug={gameSlug}>
      <main className="min-h-screen">
        <SearchParamsBridge onParams={seedFromUrl} />
        <SearchParamsBridge onParams={paged.onParams} />
        <section ref={paged.topRef} className="relative scroll-mt-24 overflow-hidden">
          <div className="relative mx-auto w-full max-w-7xl px-4 pb-5 pt-2 sm:px-6 sm:pb-6 sm:pt-3 lg:px-8">
            <CategoryHeader
              gameName={gameName}
              gameImageUrl={gameImageUrl}
              categoryLabel={categoryLabel}
              count={items.length}
              countNoun={{ one: itemNoun.replace(/s$/, '').toLowerCase(), many: itemNoun.toLowerCase() }}
              stats={stats}
              introLine={introLine}
            />

            {/* The listings view's filter bar, unchanged (owner, 2026-09-28 / 09-30). */}
            <div className="[--h-btn-secondary:40px] [--h-input:40px] sm:[--h-btn-secondary:42px] sm:[--h-input:42px]">
              <div className="max-sm:w-fit max-sm:max-w-full max-sm:overflow-hidden max-sm:rounded-lg max-sm:border max-sm:border-white/[0.08] max-sm:bg-bg-well max-sm:[--h-btn-secondary:34px]">
                <ScrollRow
                  edgeColor="var(--color-bg-well)"
                  className="flex items-center overflow-x-auto [scrollbar-width:none] max-sm:w-max max-sm:max-w-full max-sm:gap-0.5 max-sm:p-0.5 sm:flex-wrap sm:gap-2 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
                >
                  {options.types.length > 1 && (
                    <MultiSelectFilter label="Item Type" icon={iconForFilter('type')} options={toTaxonomy(options.types)} selected={types} onChange={setTypes} />
                  )}
                  {options.rarities.length > 1 && (
                    <MultiSelectFilter label="Rarity" icon={iconForFilter('rarity')} options={toTaxonomy(options.rarities)} selected={rarities} onChange={setRarities} />
                  )}
                  {options.forms.length > 0 && (
                    <MultiSelectFilter label="Traits" icon={iconForFilter('trait')} options={toTaxonomy(options.forms)} selected={forms} onChange={setForms} />
                  )}
                  {priceBounds[1] > priceBounds[0] && <PriceRangeFilter bounds={priceBounds} value={price} onChange={setPrice} />}
                  <SingleSelectFilter title="Sort By" options={SORT_OPTIONS} value={sort} onChange={setSort} />
                </ScrollRow>
              </div>

              <div className="relative mt-2.5 w-full">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={`Search for a ${itemNoun.replace(/s$/, '')}`}
                  aria-label={`Search ${gameName} ${itemNoun.toLowerCase()}`}
                  className="w-full appearance-none rounded-lg border border-white/[0.08] bg-bg-well pl-10 pr-3 text-[16px] text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-white/[0.14] focus:border-white/25 focus-visible:shadow-none sm:text-[length:var(--fs-body)] [&::-webkit-search-cancel-button]:appearance-none"
                  style={{ height: 'var(--h-input)' }}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg bg-bg-raised px-6 py-14 text-center">
              <p className="font-semibold text-text-primary" style={{ fontSize: 'var(--fs-card-title)' }}>
                {q.trim() ? `No ${itemNoun.toLowerCase()} match "${q.trim()}"` : `No ${itemNoun.toLowerCase()} match these filters`}
              </p>
              <button type="button" onClick={clear} className="mt-4 inline-flex h-10 items-center rounded-md bg-white/[0.07] px-4 text-[14px] font-semibold text-text-primary transition-colors hover:bg-white/[0.11]">
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--gap-grid)' }}>
                {paged.visible.map((item) => (
                  <li key={item.slug}>
                    <GridCard item={item} gameSlug={gameSlug} />
                  </li>
                ))}
              </ul>
              <Pagination page={paged.page} totalPages={paged.totalPages} totalItems={sorted.length} pageSize={PAGE_SIZE} onChange={paged.goTo} />
            </>
          )}

          {moreListings.length > 0 && (
            <section aria-labelledby="more-listings" className="mt-14">
              <h2 id="more-listings" className="mb-4 font-semibold text-text-primary" style={{ fontSize: 'var(--fs-section)' }}>
                More {gameName} Listings
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" style={{ gap: 'var(--gap-grid)' }}>
                {moreListings.map((o) => (
                  <ItemCard key={o.id} offer={o} gameSlug={gameSlug} gameName={gameName} isOwn={!!user?.id && o.sellerId === user.id} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </StockAlertsProvider>
  )
}
