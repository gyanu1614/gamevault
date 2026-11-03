'use client'

/**
 * The Items page on a values game (owner, 2026-10-24): one card per catalogue
 * item (GridCard) instead of one per listing. Same header as the listings
 * view (CategoryHeader), so the two never look different. Owner, 2026-11-02
 * (Eldorado's item grid as the reference): two cards to a row on phones, four
 * on wide screens; search and filters on ONE row on desktop, search + a
 * Filters sheet below lg; the ask to sell is the sub-navbar's button on
 * desktop and a row inside the grid below lg. Filters, sort and search run on
 * the client over the full list; the page number lives in the URL (?page=),
 * read through SearchParamsBridge so the first page stays in the static HTML.
 */
import { Fragment, useCallback, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { SearchParamsBridge } from '@/components/navigation/SearchParamsBridge'
import { Pagination } from '@/components/marketplace/Pagination'
import { CategoryHeader } from '@/components/marketplace/CategoryHeader'
import { SellerPromptRow } from '@/components/seller/SellerPrompt'
import { useUrlPage } from '@/hooks/use-url-page'
import { useAuth } from '@/hooks/use-auth'
import ItemCard from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemCard'
import { MultiSelectFilter, PriceRangeFilter, SingleSelectFilter, iconForFilter } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemFilters'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { TraitFilterMenu } from '@/features/item-buy/TraitFilterMenu'
import { formLetters, toggleFilterLetter } from '@/features/item-buy/model/am-traits'
import { variantShortCode } from '@/lib/value-listings/catalogs'
import { filterGrid, sortGrid, splitByForm, type FilterOption, type GridItem, type GridSort } from './model/grid'
import { GridCard } from './GridCard'
import { GridFiltersSheet, type GridFilterControls } from './GridFiltersSheet'
import { StockAlertsProvider } from './stock-alerts-context'

const PAGE_SIZE = 24
/** Below lg the Sell row follows this many cards: full rows at two and three columns. */
const SELL_ROW_AFTER = 6

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
  /** "Pets", "Brainrots", "Items": the heading, the search placeholder and the count. */
  itemNoun: string
  items: GridItem[]
  options: { rarities: FilterOption[]; types: FilterOption[]; forms: FilterOption[] }
  stats?: { count: number; lowPrice: number | null; avgDeliveryLabel: string | null } | null
  introLine?: string | null
  /** Live listings not linked to any catalogue item (bundles, odd titles). */
  moreListings: ItemOffer[]
}

export default function ItemsGridClient({ gameSlug, gameName, gameImageUrl, itemNoun, items, options, stats, introLine, moreListings }: ItemsGridClientProps) {
  const { user } = useAuth()
  const isAm = gameSlug === 'adopt-me'
  const [rarities, setRarities] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])
  // Adopt Me: the N / M / F / R letters land on ONE form (the pet page's rule); other games pick forms.
  const [traitForm, setTraitForm] = useState<string | null>(null)
  const [pickedForms, setPickedForms] = useState<string[]>([])
  const [price, setPrice] = useState<[number, number] | null>(null)
  const [sort, setSort] = useState<GridSort>('recommended')
  const [q, setQ] = useState('')

  const forms = useMemo(() => {
    if (!isAm) return pickedForms
    const code = traitForm ? variantShortCode(gameSlug, traitForm) : null
    return code ? [code] : []
  }, [isAm, pickedForms, traitForm, gameSlug])

  // A ?search= deep link (old value-page links) seeds the search once.
  const seedFromUrl = useCallback((params: URLSearchParams) => {
    const s = params.get('search')
    if (s) setQ((cur) => cur || s)
  }, [])

  const priceBounds = useMemo<[number, number]>(() => {
    const prices = items.map((i) => i.minPrice).filter((p): p is number => p != null)
    return prices.length > 0 ? [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))] : [0, 0]
  }, [items])
  const hasPrice = priceBounds[1] > priceBounds[0]
  const hasTraits = options.forms.length > 0

  const sorted = useMemo(() => {
    const f = { rarities, types, forms, minPrice: price?.[0] ?? null, maxPrice: price?.[1] ?? null, search: q }
    return sortGrid(splitByForm(filterGrid(items, f), f), sort)
  }, [items, rarities, types, forms, price, q, sort])
  const filterKey = [rarities.join(','), types.join(','), forms.join(','), price?.join('-') ?? '', q.trim(), sort].join('|')
  const paged = useUrlPage(sorted, PAGE_SIZE, filterKey)

  const clearFilters = () => {
    setRarities([])
    setTypes([])
    setTraitForm(null)
    setPickedForms([])
    setPrice(null)
  }
  const clearAll = () => {
    clearFilters()
    setQ('')
  }

  const lit = useMemo(() => new Set(formLetters(traitForm)), [traitForm])
  const controls: GridFilterControls = {
    sort: { value: sort, options: SORT_OPTIONS, onChange: setSort },
    rarities: { options: options.rarities, selected: rarities, onChange: setRarities },
    types: { options: options.types, selected: types, onChange: setTypes },
    letters: isAm && hasTraits ? { lit, onToggle: (l) => setTraitForm((f) => toggleFilterLetter(f, l)) } : null,
    forms: !isAm && hasTraits ? { options: options.forms, selected: pickedForms, onChange: setPickedForms } : null,
    price: hasPrice ? { bounds: priceBounds, value: price, onChange: setPrice } : null,
    active: (rarities.length > 0 ? 1 : 0) + (types.length > 0 ? 1 : 0) + (forms.length > 0 ? 1 : 0) + (price ? 1 : 0),
    onClear: clearFilters,
  }
  const TraitIcon = iconForFilter('trait')
  const sellAfter = Math.min(SELL_ROW_AFTER, paged.visible.length) - 1

  return (
    <StockAlertsProvider gameSlug={gameSlug}>
      <main className="min-h-screen">
        <SearchParamsBridge onParams={seedFromUrl} />
        <SearchParamsBridge onParams={paged.onParams} />
        <section ref={paged.topRef} className="relative scroll-mt-game-chrome overflow-hidden">
          <div className="relative mx-auto w-full max-w-7xl px-4 pb-5 pt-2 sm:px-6 sm:pb-6 sm:pt-3 lg:px-8">
            {/* The heading says what people search for: "Adopt Me Pets", not the category's "Items". */}
            <CategoryHeader
              gameName={gameName}
              gameImageUrl={gameImageUrl}
              categoryLabel={itemNoun}
              count={items.length}
              countNoun={{ one: itemNoun.replace(/s$/, '').toLowerCase(), many: itemNoun.toLowerCase() }}
              stats={stats}
              introLine={introLine}
            />

            <div className="flex items-center gap-2.5 [--h-btn-secondary:42px] [--h-input:44px] lg:[--h-input:42px]">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={`Search for a ${itemNoun.replace(/s$/, '')}`}
                  aria-label={`Search ${gameName} ${itemNoun.toLowerCase()}`}
                  className="w-full appearance-none rounded-lg border border-white/[0.08] bg-bg-well pl-10 pr-3 text-[16px] text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-white/[0.14] focus:border-white/25 focus-visible:shadow-none lg:text-[length:var(--fs-body)] [&::-webkit-search-cancel-button]:appearance-none"
                  style={{ height: 'var(--h-input)' }}
                />
              </div>

              {/* Desktop: the filters beside the search, on the same row. */}
              <div className="hidden shrink-0 items-center gap-2 lg:flex">
                {options.types.length > 1 && (
                  <MultiSelectFilter label="Item Type" icon={iconForFilter('type')} options={toTaxonomy(options.types)} selected={types} onChange={setTypes} />
                )}
                {options.rarities.length > 1 && (
                  <MultiSelectFilter label="Rarity" icon={iconForFilter('rarity')} options={toTaxonomy(options.rarities)} selected={rarities} onChange={setRarities} />
                )}
                {controls.letters ? (
                  <TraitFilterMenu
                    lit={lit}
                    onToggle={controls.letters.onToggle}
                    onClear={() => setTraitForm(null)}
                    leading={<TraitIcon aria-hidden className="h-4 w-4 shrink-0 text-text-secondary" />}
                    className={lit.size > 0 ? 'h-[var(--h-btn-secondary)] bg-white/[0.11] px-3.5' : 'h-[var(--h-btn-secondary)] px-3.5'}
                  />
                ) : controls.forms ? (
                  <MultiSelectFilter label="Traits" icon={TraitIcon} options={toTaxonomy(options.forms)} selected={pickedForms} onChange={setPickedForms} />
                ) : null}
                {hasPrice && <PriceRangeFilter bounds={priceBounds} value={price} onChange={setPrice} />}
                <SingleSelectFilter title="Sort By" options={SORT_OPTIONS} value={sort} onChange={setSort} />
              </div>

              {/* Phones and tablets: one Filters button, everything else in its sheet. */}
              <GridFiltersSheet controls={controls} className="lg:hidden" />
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg bg-bg-raised px-6 py-14 text-center">
              <p className="font-semibold text-text-primary" style={{ fontSize: 'var(--fs-card-title)' }}>
                {q.trim() ? `No ${itemNoun.toLowerCase()} match "${q.trim()}"` : `No ${itemNoun.toLowerCase()} match these filters`}
              </p>
              <button type="button" onClick={clearAll} className="mt-4 inline-flex h-10 items-center rounded-md bg-white/[0.07] px-4 text-[14px] font-semibold text-text-primary transition-colors hover:bg-white/[0.11]">
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4" style={{ gap: 'var(--gap-grid)' }}>
                {paged.visible.map((item, i) => (
                  <Fragment key={item.key}>
                    <li>
                      <GridCard item={item} gameSlug={gameSlug} />
                    </li>
                    {paged.page === 1 && i === sellAfter && (
                      <li className="col-span-full lg:hidden">
                        <SellerPromptRow gameName={gameName} categoryLabel={itemNoun} />
                      </li>
                    )}
                  </Fragment>
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
