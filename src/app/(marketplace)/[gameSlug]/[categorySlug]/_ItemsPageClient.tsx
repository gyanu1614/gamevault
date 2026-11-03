'use client'

/**
 * V15 — Items page client.
 *
 * Implements the design_handoff_items_page §3-7 spec: filter band with
 * three Radix-Select dropdowns + search, results bar with sort, Showcase
 * card grid, empty state, and numbered pages (?page=N).
 *
 * The filter dropdowns pull their options from the per-(game, items)
 * attribute_templates so this page works for any game without code
 * changes — Steal-a-Brainrot, Adopt Me, Blox Fruits, MM2, all the same.
 */

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SearchParamsBridge } from '@/components/navigation/SearchParamsBridge'
import { useAuth } from '@/hooks/use-auth'
import { useUrlPage } from '@/hooks/use-url-page'
import { Pagination } from '@/components/marketplace/Pagination'
import { Search, Store } from 'lucide-react'
import { track } from '@vercel/analytics'
import { track as phTrack } from '@/lib/analytics/client'
import { CategoryHeader } from '@/components/marketplace/CategoryHeader'
import { FilterToolbar, type AppliedFilter } from '@/components/marketplace/FilterToolbar'
import { SheetChips, SheetPickOne, type FilterSheetSection } from '@/components/marketplace/FiltersSheet'
import { SellerPromptRow } from '@/components/seller/SellerPrompt'
import { useSellerPrompt } from '@/hooks/use-seller-prompt'
import { SELLER_PROMPT_EVENT, listingsEmptyCopy, sellerPromptHref } from '@/lib/seller/seller-prompt'
import { bestOfferId, sortOffers } from './_itemsSort'
import ItemCard from './_ItemCard'
import Link from 'next/link'
import { closestByName } from '@/lib/value-listings/closest'
import type {
  ItemOffer,
  ItemsTaxonomy,
  ItemSort,
} from './_itemsTypes'
import { MultiSelectFilter, PriceRangeFields, PriceRangeFilter, SingleSelectFilter, titleCase } from './_ItemFilters'
import { parseDeliveryMinutes } from '@/lib/utils/delivery-time'

const PAGE_SIZE = 24
/** Phones and tablets: the Sell row follows this many listings (two full rows on a two-column tablet). */
const SELL_ROW_AFTER = 4

/**
 * Delivery-time filter options. Non-overlapping windows, so ticking several
 * simply widens the match. Built from each listing's seller-set delivery
 * time via the shared `parseDeliveryMinutes`; only windows that at least
 * one listing on the page falls into are offered.
 */
const DELIVERY_BUCKETS: { slug: string; label: string; test: (m: number) => boolean }[] = [
  { slug: 'under-20m', label: 'Up to 20 Mins', test: (m) => m <= 20 },
  { slug: '20m-1h', label: '20 Mins – 1 Hour', test: (m) => m > 20 && m <= 60 },
  { slug: '1h-6h', label: '1 – 6 Hours', test: (m) => m > 60 && m <= 360 },
  { slug: '6h-24h', label: '6 – 24 Hours', test: (m) => m > 360 && m <= 1440 },
  { slug: 'over-24h', label: 'Over 24 Hours', test: (m) => m > 1440 },
]
const bucketOf = (raw: string | null) => {
  const m = parseDeliveryMinutes(raw)
  return DELIVERY_BUCKETS.find((b) => b.test(m))?.slug ?? null
}
const SORT_OPTIONS: { slug: ItemSort; label: string }[] = [
  { slug: 'recommended', label: 'Recommended' },
  { slug: 'price-asc', label: 'Price: Low to High' },
  { slug: 'price-desc', label: 'Price: High to Low' },
  { slug: 'top-rated', label: 'Top Rated' },
  { slug: 'best-sellers', label: 'Most Sales' },
]


interface ItemsPageClientProps {
  gameSlug: string
  gameName: string
  tagline?: string
  offers: ItemOffer[]
  taxonomy: ItemsTaxonomy
  /** V21/P7.l — Category label for the header (e.g. "Items",
   *  "Accounts", "Boosting"). Defaults to "Items" for back-compat. */
  categoryLabel?: string
  /** SEO intro sentence (live stats), server-computed so it lands in
   *  the initial HTML. Kept for the crawler even when we render chips. */
  introLine?: string | null
  /** Live category stats — rendered as scannable stat chips in the header. */
  stats?: {
    count: number
    lowPrice: number | null
    avgDeliveryLabel: string | null
  } | null
}

export default function ItemsPageClient({
  gameSlug,
  gameName,
  offers,
  taxonomy,
  categoryLabel = 'Items',
  introLine,
  stats,
}: ItemsPageClientProps) {
  // V14v — Scroll to top on mount before paint.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [])

  // V14m/Step 7a — viewer from the client auth context (self-purchase block).
  const { user: viewer } = useAuth()
  const viewerId = viewer?.id ?? null

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 200)
    return () => clearTimeout(t)
  }, [q])

  // Selected values per attribute (multi-select). Seeded from the URL after
  // hydration by seedFromUrl below.
  const [attrFilters, setAttrFilters] = useState<Record<string, string[]>>({})

  // V21/P7.v — Seed filters from the URL so a navbar search hit like
  // "garama" can deep-link to this page with the filter pre-applied:
  // /steal-a-brainrot/buy-items?attr_category=garama. We read each
  // `attr_<slug>` param and keep only those whose option actually exists
  // in this category's taxonomy (defensive against stale links).
  //
  // Step 7a — read through SearchParamsBridge after hydration (the page is
  // ISR; useSearchParams() here would drop this whole grid out of the static
  // HTML). Seed ONCE, as before: later filter changes are local state, not
  // URL-driven.
  //
  // Multi-select: `attr_<slug>=a,b` seeds two values; the single-value form
  // (`attr_<slug>=a`, used by navbar search links) still works.
  const seededRef = useRef(false)
  const seedFromUrl = useCallback(
    (params: URLSearchParams) => {
      if (seededRef.current) return
      seededRef.current = true
      const search = params.get('search')?.trim() ?? ''
      if (search) {
        setQ(search)
        setDebouncedQ(search.toLowerCase())
      }
      const seeded: Record<string, string[]> = {}
      for (const f of taxonomy.filters ?? []) {
        const raw = params.get(`attr_${f.slug}`)
        if (!raw) continue
        const valid = raw.split(',').filter((v) => f.options.some((o) => o.slug === v))
        if (valid.length) seeded[f.slug] = valid
      }
      if (Object.keys(seeded).length > 0) setAttrFilters(seeded)
    },
    [taxonomy],
  )
  // Selected values per attribute, keyed by attribute slug. An empty (or
  // missing) list means the filter is off. Several values in one filter
  // match ANY of them; different filters must ALL match.
  const setAttrFilter = (slug: string, values: string[]) => {
    setAttrFilters((prev) => {
      const next = { ...prev, [slug]: values }
      // V15b — Reset descendants when a parent changes so stale child
      // selections don't silently filter out everything.
      if (taxonomy.filters) {
        for (const child of taxonomy.filters) {
          if (child.slug === slug) continue
          const dependsOnUs = child.conditionalRules.some(
            (r) => r.triggerAttrSlug === slug,
          )
          if (dependsOnUs) next[child.slug] = []
        }
      }
      return next
    })
  }
  const getAttrFilter = (slug: string): string[] => attrFilters[slug] ?? []

  // Price slider limits: the cheapest and dearest listing on this page.
  const priceBounds = useMemo<[number, number]>(() => {
    const prices = offers.map((o) => o.pricePerUnit).filter((p) => p > 0)
    if (prices.length === 0) return [0, 0]
    return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))]
  }, [offers])
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null)

  const [delivery, setDelivery] = useState<string[]>([])
  const deliveryOptions = useMemo(() => {
    const present = new Set(offers.map((o) => bucketOf(o.deliveryTime)))
    return DELIVERY_BUCKETS.filter((b) => present.has(b.slug)).map((b) => ({ slug: b.slug, label: b.label }))
  }, [offers])

  const [sort, setSort] = useState<ItemSort>('recommended')

  // V15b — Conditional-rule evaluator that runs against the CURRENT
  // filter state (not against a listing's data). Used to decide which
  // filter dropdowns to render. Mirrors the semantics of
  // isAttributeVisible() server-side.
  const isFilterVisible = (slug: string): boolean => {
    const attr = taxonomy.filters.find((f) => f.slug === slug)
    if (!attr) return false
    const rules = attr.conditionalRules
    if (rules.length === 0) return true
    // A child filter shows once its parent has a selection and at least one
    // selected parent value satisfies the rule.
    for (const r of rules) {
      const parentValues = getAttrFilter(r.triggerAttrSlug)
      if (parentValues.length === 0) return false
      const triggers = r.triggerValues
      const passes = (v: string) => {
        switch (r.operator) {
          case 'equals':     return triggers[0] === v
          case 'not_equals': return triggers[0] !== v
          case 'in':         return triggers.includes(v)
          case 'not_in':     return !triggers.includes(v)
        }
      }
      if (!parentValues.some(passes)) return false
    }
    return true
  }

  const visibleFilters = useMemo(
    () => taxonomy.filters.filter((f) => isFilterVisible(f.slug)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taxonomy.filters, attrFilters],
  )

  const filtered = useMemo(() => {
    return offers.filter((o) => {
      // Apply every ACTIVE filter whose dropdown is currently visible.
      // Listings that are missing the attribute fall through (defensive —
      // legacy rows without template_data wouldn't be filtered out unless
      // the seller actively picks a value).
      for (const f of visibleFilters) {
        const picked = getAttrFilter(f.slug)
        if (picked.length === 0) continue
        const listingValue = o.attributeValues[f.slug]
        if (!listingValue) return false
        const values = Array.isArray(listingValue) ? listingValue : [listingValue]
        if (!values.some((v) => picked.includes(v))) return false
      }
      if (priceRange && (o.pricePerUnit < priceRange[0] || o.pricePerUnit > priceRange[1])) {
        return false
      }
      if (delivery.length > 0) {
        const b = bucketOf(o.deliveryTime)
        if (!b || !delivery.includes(b)) return false
      }
      if (debouncedQ) {
        // Item name only — this box searches items, not sellers.
        const hay = o.name.toLowerCase()
        if (!hay.includes(debouncedQ)) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers, attrFilters, priceRange, delivery, debouncedQ, visibleFilters])

  // Best offer (cheapest in stock) is flagged on its card and pinned first
  // in the default order; see _itemsSort.ts. Computed from `filtered` so the
  // flag is stable whatever the sort.
  const bestDealId = useMemo(() => bestOfferId(filtered), [filtered])
  const sorted = useMemo(() => sortOffers(filtered, sort), [filtered, sort])

  // Numbered pages in the URL (?page=N). A filter, sort or search change
  // starts again at page 1; the key is the filter VALUES, not the list
  // (the list is rebuilt on unrelated renders and would reset every time).
  const filterKey = JSON.stringify([debouncedQ, attrFilters, priceRange, delivery, sort])
  const paged = useUrlPage(sorted, PAGE_SIZE, filterKey)
  const visible = paged.visible

  const clearApplied = () => {
    setAttrFilters({})
    setPriceRange(null)
    setDelivery([])
  }
  const clearFilters = () => {
    setQ('')
    clearApplied()
    setSort('recommended')
  }

  const hasPrice = priceBounds[1] > priceBounds[0]
  const hasDelivery = deliveryOptions.length > 1
  const sections: FilterSheetSection[] = [
    { key: 'sort', title: 'Sort By', content: <SheetPickOne options={SORT_OPTIONS} value={sort} onChange={setSort} /> },
    ...visibleFilters.map((f) => ({
      key: f.slug,
      title: titleCase(f.label),
      content: <SheetChips options={f.options} selected={getAttrFilter(f.slug)} onChange={(v) => setAttrFilter(f.slug, v)} />,
    })),
    ...(hasPrice ? [{ key: 'price', title: 'Price', content: <PriceRangeFields bounds={priceBounds} value={priceRange} onChange={setPriceRange} /> }] : []),
    ...(hasDelivery ? [{ key: 'delivery', title: 'Delivery Time', content: <SheetChips options={deliveryOptions} selected={delivery} onChange={setDelivery} /> }] : []),
  ]
  const applied: AppliedFilter[] = [
    ...visibleFilters.flatMap((f) =>
      getAttrFilter(f.slug).map((v) => ({
        key: `${f.slug}:${v}`,
        label: f.options.find((o) => o.slug === v)?.label ?? v,
        onRemove: () => setAttrFilter(f.slug, getAttrFilter(f.slug).filter((x) => x !== v)),
      })),
    ),
    ...(priceRange ? [{ key: 'price', label: `$${priceRange[0]} – $${priceRange[1]}`, onRemove: () => setPriceRange(null) }] : []),
    ...delivery.map((v) => ({
      key: `delivery:${v}`,
      label: deliveryOptions.find((o) => o.slug === v)?.label ?? v,
      onRemove: () => setDelivery((c) => c.filter((x) => x !== v)),
    })),
  ]

  return (
    <main className="min-h-screen">
      <SearchParamsBridge onParams={seedFromUrl} />
      <SearchParamsBridge onParams={paged.onParams} />
      {/* scroll-mt clears the fixed navbar + sub-navbar when a page change scrolls here. */}
      <section ref={paged.topRef} className="scroll-mt-game-chrome">
        <div className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 sm:pt-4 lg:px-8">
          <CategoryHeader
            gameName={gameName}
            categoryLabel={categoryLabel}
            count={sorted.length}
            countNoun={{ one: 'listing', many: 'listings' }}
            stats={stats}
            introLine={introLine}
          />
        </div>
      </section>

      <FilterToolbar
        search={{ value: q, onChange: setQ, placeholder: `Search ${categoryLabel}`, ariaLabel: `Search ${gameName} ${categoryLabel}` }}
        filters={
          <>
            {/* Attribute filters (admin-defined per game), then Price and
                Delivery Time. All multi-select except Price (a range). */}
            {visibleFilters.map((f) => (
              <MultiSelectFilter key={f.slug} label={titleCase(f.label)} options={f.options} selected={getAttrFilter(f.slug)} onChange={(v) => setAttrFilter(f.slug, v)} />
            ))}
            {hasPrice && <PriceRangeFilter icon={null} bounds={priceBounds} value={priceRange} onChange={setPriceRange} />}
            {hasDelivery && <MultiSelectFilter label="Delivery Time" options={deliveryOptions} selected={delivery} onChange={setDelivery} />}
          </>
        }
        sort={<SingleSelectFilter title="Sort By" prefix="Sort" options={SORT_OPTIONS} value={sort} onChange={setSort} />}
        sections={sections}
        applied={applied}
        onClearFilters={clearApplied}
      />

      {/* Results + grid */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-3 sm:px-6 lg:px-8">

        {sorted.length === 0 ? (
          <EmptyState
            onClear={clearFilters}
            query={q.trim()}
            sellHref={`/${gameSlug}/sell?src=buy-search-empty`}
            categoryEmpty={offers.length === 0}
            gameName={gameName}
            categoryLabel={categoryLabel}
            matches={closestByName(offers, q, 6).map((o) => (
              <ItemCard
                key={o.id}
                offer={o}
                gameSlug={gameSlug}
                gameName={gameName}
                isOwn={!!viewerId && o.sellerId === viewerId}
              />
            ))}
          />
        ) : (
          <>
            {/* V15e — Landscape cards work best at 380px+ widths.
                Single column on mobile, two on tablet, three on desktop. */}
            {/* V15q — Wider gutter between cards. The previous gap-3/4
                made adjacent landscape cards touch their hover shadows
                and felt cramped. Now: gap-5 on mobile, gap-6 on sm+ so
                each card has breathing room horizontally AND vertically. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" style={{ gap: 'var(--gap-grid)' }}>
              {visible.map((o, i) => (
                <Fragment key={o.id}>
                  <ItemCard
                    offer={o}
                    gameSlug={gameSlug}
                    gameName={gameName}
                    isOwn={!!viewerId && o.sellerId === viewerId}
                    isBestDeal={o.id === bestDealId}
                  />
                  {/* Below lg the ask to sell sits here, after the first cards (desktop: the sub-navbar's button). */}
                  {paged.page === 1 && i === Math.min(SELL_ROW_AFTER, visible.length) - 1 && (
                    <SellerPromptRow gameName={gameName} categoryLabel={categoryLabel} className="col-span-full lg:hidden" />
                  )}
                </Fragment>
              ))}
            </div>

            <Pagination
              page={paged.page}
              totalPages={paged.totalPages}
              totalItems={sorted.length}
              pageSize={PAGE_SIZE}
              onChange={paged.goTo}
            />
          </>
        )}
      </div>
    </main>
  )
}

/**
 * Nothing matched. With a search (e.g. a value page's old ?search= link) it
 * says so in one line and shows the closest listings on this page instead of
 * an empty grid (Bundle 2); without one, the original "clear filters" state.
 */
function EmptyState({
  onClear,
  query,
  sellHref,
  matches,
  categoryEmpty,
  gameName,
  categoryLabel,
}: {
  onClear: () => void
  query: string
  sellHref: string
  matches: React.ReactNode[]
  /** No listings in this category at all (not a filter miss). */
  categoryEmpty: boolean
  gameName: string
  categoryLabel: string
}) {
  if (categoryEmpty) return <CategoryEmptyState gameName={gameName} categoryLabel={categoryLabel} />
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center justify-center rounded-lg bg-bg-raised px-6 py-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-white/[0.05] text-text-secondary">
          <Search className="h-5 w-5" />
        </div>
        <h3 className="font-bold text-text-primary" style={{ fontSize: 'var(--fs-section)', lineHeight: 'var(--lh-section)' }}>
          {query ? `No ${query} listed right now.` : 'No items match your filters'}
        </h3>
        {!query ? (
          <p className="mt-2 max-w-sm leading-relaxed text-text-secondary" style={{ fontSize: 'var(--fs-meta)', lineHeight: 'var(--lh-body)' }}>
            Try a different search, category, or type — or clear everything to see the full catalog.
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white/[0.07] px-4 font-semibold text-text-primary transition-colors hover:bg-white/[0.11]"
            style={{ minHeight: 'var(--h-btn-primary)', fontSize: 'var(--fs-meta)' }}
          >
            Clear Filters
          </button>
          {query ? (
            <Link
              href={sellHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-lime px-4 font-bold text-text-inverse transition-colors hover:bg-lime-hover active:bg-lime-pressed"
              style={{ minHeight: 'var(--h-btn-primary)', fontSize: 'var(--fs-meta)' }}
            >
              Sell Yours For Cash
            </Link>
          ) : null}
        </div>
      </div>
      {query && matches.length > 0 ? (
        <section aria-labelledby="closest-matches">
          <h2 id="closest-matches" className="mb-4 font-bold text-text-primary" style={{ fontSize: 'var(--fs-section)' }}>
            Closest Matches
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" style={{ gap: 'var(--gap-grid)' }}>
            {matches}
          </div>
        </section>
      ) : null}
    </div>
  )
}

/**
 * The category has nothing in it yet: the seller prompt as the empty state
 * ("Be the first to list …"). The words are the same for everyone; only the
 * door changes — a seller goes straight to the wizard, everyone else to
 * /founding — so the static HTML never flashes.
 */
function CategoryEmptyState({ gameName, categoryLabel }: { gameName: string; categoryLabel: string }) {
  const { state, forgetCount } = useSellerPrompt()
  const variant = state === 'seller' ? 'seller' : 'visitor'
  const copy = listingsEmptyCopy(variant, gameName, categoryLabel)
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-lime-tint-border bg-bg-raised px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-lime-tint-bg text-lime-text">
        <Store className="h-6 w-6" />
      </div>
      <h3 className="font-bold text-text-primary" style={{ fontSize: 'var(--fs-section)', lineHeight: 'var(--lh-section)' }}>
        {copy.title}
      </h3>
      <p className="mt-2 max-w-sm leading-relaxed text-text-secondary" style={{ fontSize: 'var(--fs-meta)', lineHeight: 'var(--lh-body)' }}>
        {copy.body}
      </p>
      <Link
        href={sellerPromptHref(variant, 'listings-empty')}
        onClick={() => {
          track(SELLER_PROMPT_EVENT[variant], { source: 'listings-empty' })
          if (variant === 'visitor') phTrack('seller_banner_clicked', { source: 'listings-empty' })
          if (variant === 'seller') forgetCount()
        }}
        className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-md bg-lime px-5 font-bold text-text-inverse transition-colors hover:bg-lime-hover active:bg-lime-pressed"
        style={{ minHeight: 'var(--h-btn-primary)', fontSize: 'var(--fs-meta)' }}
      >
        {copy.cta}
      </Link>
    </div>
  )
}
