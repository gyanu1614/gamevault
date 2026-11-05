'use client'

/**
 * The Items page on a values game (owner, 2026-10-24): one card per catalogue
 * item (GridCard) instead of one per listing. Same header as the listings
 * view (CategoryHeader, FilterToolbar), so the two never look different. Owner,
 * 2026-11-02 (Eldorado's item grid as the reference): two cards to a row on
 * phones, four on wide screens; the ask to sell is the sub-navbar's button on
 * desktop and a row inside the grid below lg. Filters, sort and search run on
 * the client over the full list; the page number lives in the URL (?page=),
 * read through SearchParamsBridge so the first page stays in the static HTML.
 */
import { Fragment, useCallback, useMemo, useState } from 'react'
import { EggIcon } from '@phosphor-icons/react/dist/ssr/Egg'
import { FlaskIcon } from '@phosphor-icons/react/dist/ssr/Flask'
import { PawPrintIcon } from '@phosphor-icons/react/dist/ssr/PawPrint'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import { SearchParamsBridge } from '@/components/navigation/SearchParamsBridge'
import { Pagination } from '@/components/marketplace/Pagination'
import { CategoryHeader } from '@/components/marketplace/CategoryHeader'
import { PAGE_TOP, SECTION_GAP, SECTION_TITLE, TITLE_GAP_BELOW } from '@/components/marketplace/page-scale'
import { cn } from '@/lib/utils'
import { FilterToolbar, type AppliedFilter } from '@/components/marketplace/FilterToolbar'
import { SheetChips, SheetPickOne, type FilterSheetSection } from '@/components/marketplace/FiltersSheet'
import { SellerPromptRow } from '@/components/seller/SellerPrompt'
import { useUrlPage } from '@/hooks/use-url-page'
import { useAuth } from '@/hooks/use-auth'
import ItemCard from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemCard'
import { MultiSelectFilter, PriceRangeFields, PriceRangeFilter, SingleSelectFilter } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemFilters'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { TRAIT_LETTERS, TraitFilterMenu, TraitSheetButtons } from '@/features/item-buy/TraitFilterMenu'
import { TraitMarks } from '@/features/item-buy/TraitMarks'
import type { AmLetter } from '@/features/item-buy/model/am-traits'
import { AM_ITEM_TYPES, amTypesHeading, type AmItemType } from '@/lib/value-listings/am-item-kind'
import { filterGrid, formsForLetters, sortGrid, splitByForm, toggleGridLetter, type FilterOption, type GridItem, type GridSort } from './model/grid'
import { GridCard } from './GridCard'
import { StockAlertsProvider } from './stock-alerts-context'

const PAGE_SIZE = 24
/** Below lg the Sell row follows this many cards: full rows at two and three columns. */
const SELL_ROW_AFTER = 6

const SORT_OPTIONS: { slug: GridSort; label: string }[] = [
  { slug: 'recommended', label: 'Popular' },
  { slug: 'cheapest', label: 'Cheapest First' },
  { slug: 'priciest', label: 'Priciest First' },
]

const toTaxonomy = (xs: FilterOption[]) => xs.map((x) => ({ slug: x.value, label: x.label }))

/** Adopt Me's tabs (owner, 2026-11-04: eggs and potions on this page, better than Eldorado's one mixed grid). */
type TypeTab = 'All' | AmItemType
const TAB_WORDS: Record<TypeTab, { one: string; many: string; search: string }> = {
  All: { one: 'item', many: 'items', search: 'Search for a Pet, Egg or Potion' },
  Pets: { one: 'pet', many: 'pets', search: 'Search for a Pet' },
  Eggs: { one: 'egg', many: 'eggs', search: 'Search for an Egg' },
  Potions: { one: 'potion', many: 'potions', search: 'Search for a Potion' },
}
const TAB_ICON = { Pets: PawPrintIcon, Eggs: EggIcon, Potions: FlaskIcon }

export interface ItemsGridClientProps {
  gameSlug: string
  gameName: string
  /** "Pets", "Brainrots", "Items": the heading, the search placeholder and the count. */
  itemNoun: string
  items: GridItem[]
  options: { rarities: FilterOption[]; types: FilterOption[]; forms: FilterOption[] }
  stats?: { count: number; lowPrice: number | null; avgDeliveryLabel: string | null } | null
  introLine?: string | null
  /** Live listings not linked to any catalogue item (bundles, odd titles). */
  moreListings: ItemOffer[]
}

export default function ItemsGridClient({ gameSlug, gameName, itemNoun, items, options, stats, introLine, moreListings }: ItemsGridClientProps) {
  const { user } = useAuth()
  const isAm = gameSlug === 'adopt-me'
  const [rarities, setRarities] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])
  // Adopt Me ticks N / M / F / R letters; other games pick forms by name.
  const [letters, setLetters] = useState<AmLetter[]>([])
  const [pickedForms, setPickedForms] = useState<string[]>([])
  const [price, setPrice] = useState<[number, number] | null>(null)
  const [sort, setSort] = useState<GridSort>('recommended')
  const [q, setQ] = useState('')

  const forms = useMemo(() => (isAm ? formsForLetters(letters, options.forms.map((f) => f.value)) : pickedForms), [isAm, letters, options.forms, pickedForms])

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
  const typeTabs = isAm ? AM_ITEM_TYPES.filter((t) => options.types.some((o) => o.value === t)) : []
  const hasTypeTabs = typeTabs.length > 1
  const tab: TypeTab = hasTypeTabs ? ((types[0] as AmItemType | undefined) ?? 'All') : 'All'
  // Eggs and potions have no rarity or traits.
  const petFilters = tab === 'All' || tab === 'Pets'
  const words = hasTypeTabs ? TAB_WORDS[tab] : null
  const hasTraits = options.forms.length > 0 && petFilters

  const sorted = useMemo(() => {
    const f = { rarities, types, forms, minPrice: price?.[0] ?? null, maxPrice: price?.[1] ?? null, search: q }
    return sortGrid(splitByForm(filterGrid(items, f), f), sort)
  }, [items, rarities, types, forms, price, q, sort])
  const filterKey = [rarities.join(','), types.join(','), forms.join(','), price?.join('-') ?? '', q.trim(), sort].join('|')
  const paged = useUrlPage(sorted, PAGE_SIZE, filterKey)

  const pickTab = (next: TypeTab) => {
    setTypes(next === 'All' ? [] : [next])
    if (next === 'Eggs' || next === 'Potions') {
      setRarities([])
      setLetters([])
    }
  }
  const clearFilters = () => {
    setRarities([])
    if (!hasTypeTabs) setTypes([])
    setLetters([])
    setPickedForms([])
    setPrice(null)
  }
  const clearAll = () => {
    clearFilters()
    setQ('')
  }

  const lit = useMemo(() => new Set(letters), [letters])
  const toggleLetter = (l: AmLetter) => setLetters((cur) => toggleGridLetter(cur, l))
  const hasTypes = options.types.length > 1 && !hasTypeTabs
  const hasRarities = options.rarities.length > 1 && petFilters

  const sections: FilterSheetSection[] = [
    { key: 'sort', title: 'Sort By', content: <SheetPickOne options={SORT_OPTIONS} value={sort} onChange={setSort} /> },
    ...(hasRarities ? [{ key: 'rarity', title: 'Rarity', content: <SheetChips options={toTaxonomy(options.rarities)} selected={rarities} onChange={setRarities} /> }] : []),
    ...(hasTraits
      ? [{ key: 'traits', title: 'Traits', content: isAm ? <TraitSheetButtons lit={lit} onToggle={toggleLetter} /> : <SheetChips options={toTaxonomy(options.forms)} selected={pickedForms} onChange={setPickedForms} /> }]
      : []),
    ...(hasTypes ? [{ key: 'type', title: 'Item Type', content: <SheetChips options={toTaxonomy(options.types)} selected={types} onChange={setTypes} /> }] : []),
    ...(hasPrice ? [{ key: 'price', title: 'Price', content: <PriceRangeFields bounds={priceBounds} value={price} onChange={setPrice} /> }] : []),
  ]

  const nameOf = (list: FilterOption[], value: string) => list.find((o) => o.value === value)?.label ?? value
  const applied: AppliedFilter[] = [
    ...rarities.map((v) => ({ key: `rarity:${v}`, label: nameOf(options.rarities, v), onRemove: () => setRarities((c) => c.filter((x) => x !== v)) })),
    ...letters.map((l) => ({
      key: `trait:${l}`,
      label: TRAIT_LETTERS.find((t) => t.letter === l)?.label ?? l,
      lead: <TraitMarks code={l} size={16} />,
      onRemove: () => setLetters((c) => c.filter((x) => x !== l)),
    })),
    ...pickedForms.map((v) => ({ key: `form:${v}`, label: nameOf(options.forms, v), onRemove: () => setPickedForms((c) => c.filter((x) => x !== v)) })),
    ...(hasTypeTabs ? [] : types.map((v) => ({ key: `type:${v}`, label: nameOf(options.types, v), onRemove: () => setTypes((c) => c.filter((x) => x !== v)) }))),
    ...(price ? [{ key: 'price', label: `$${price[0]} – $${price[1]}`, onRemove: () => setPrice(null) }] : []),
  ]
  const sellAfter = Math.min(SELL_ROW_AFTER, paged.visible.length) - 1

  return (
    <StockAlertsProvider gameSlug={gameSlug}>
      <main className="min-h-screen">
        <SearchParamsBridge onParams={seedFromUrl} />
        <SearchParamsBridge onParams={paged.onParams} />
        {/* The heading says what people search for: "Adopt Me Pets", not the category's "Items". */}
        <section ref={paged.topRef} className="scroll-mt-game-chrome">
          <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', PAGE_TOP)}>
            <CategoryHeader
              gameName={gameName}
              categoryLabel={hasTypeTabs ? amTypesHeading(typeTabs) : itemNoun}
              count={sorted.length}
              countNoun={words ?? { one: itemNoun.replace(/s$/, '').toLowerCase(), many: itemNoun.toLowerCase() }}
              stats={stats}
              introLine={introLine}
            />
            {hasTypeTabs && (
              <SegmentedTabs
                tabs={(['All', ...typeTabs] as TypeTab[]).map((id) => {
                  const Icon = id === 'All' ? null : TAB_ICON[id]
                  return {
                    id,
                    label: (
                      <>
                        {Icon && <Icon aria-hidden size={18} weight="duotone" />}
                        {id}
                      </>
                    ),
                  }
                })}
                value={tab}
                onChange={pickTab}
                layoutId="item-type"
                ariaLabel={`${gameName} item types`}
                className="mb-2"
              />
            )}
          </div>
        </section>

        <FilterToolbar
          search={{ value: q, onChange: setQ, placeholder: words?.search ?? `Search for a ${itemNoun.replace(/s$/, '')}`, ariaLabel: `Search ${gameName} ${words?.many ?? itemNoun.toLowerCase()}` }}
          filters={
            <>
              {hasTypes && <MultiSelectFilter label="Item Type" options={toTaxonomy(options.types)} selected={types} onChange={setTypes} />}
              {hasRarities && <MultiSelectFilter label="Rarity" options={toTaxonomy(options.rarities)} selected={rarities} onChange={setRarities} />}
              {hasTraits &&
                (isAm ? (
                  <TraitFilterMenu lit={lit} onToggle={toggleLetter} onClear={() => setLetters([])} emptyLabel="Traits" />
                ) : (
                  <MultiSelectFilter label="Traits" options={toTaxonomy(options.forms)} selected={pickedForms} onChange={setPickedForms} />
                ))}
              {hasPrice && <PriceRangeFilter icon={null} bounds={priceBounds} value={price} onChange={setPrice} />}
            </>
          }
          sort={<SingleSelectFilter title="Sort By" prefix="Sort" options={SORT_OPTIONS} value={sort} onChange={setSort} />}
          sections={sections}
          applied={applied}
          onClearFilters={clearFilters}
        />

        {/* No bottom padding: the guide below sets the one gap between sections. */}
        <div
          className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 lg:px-8"
          {...(hasTypeTabs ? { role: 'tabpanel', id: `item-type-panel-${tab}`, 'aria-labelledby': `item-type-tab-${tab}` } : {})}
        >
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg bg-bg-raised px-6 py-14 text-center">
              <p className="font-semibold text-text-primary" style={{ fontSize: 'var(--fs-card-title)' }}>
                {q.trim() ? `No ${words?.many ?? itemNoun.toLowerCase()} match "${q.trim()}"` : `No ${words?.many ?? itemNoun.toLowerCase()} match these filters`}
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
            <section aria-labelledby="more-listings" className={SECTION_GAP}>
              <h2 id="more-listings" className={cn(SECTION_TITLE, TITLE_GAP_BELOW)}>
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
