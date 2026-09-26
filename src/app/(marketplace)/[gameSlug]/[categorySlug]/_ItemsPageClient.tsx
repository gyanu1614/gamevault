'use client'

/**
 * V15 — Items page client.
 *
 * Implements the design_handoff_items_page §3-7 spec: filter band with
 * three Radix-Select dropdowns + search, results bar with sort, Showcase
 * card grid, empty state, and Load More.
 *
 * The filter dropdowns pull their options from the per-(game, items)
 * attribute_templates so this page works for any game without code
 * changes — Steal-a-Brainrot, Adopt Me, Blox Fruits, MM2, all the same.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SearchParamsBridge } from '@/components/navigation/SearchParamsBridge'
import { useAuth } from '@/hooks/use-auth'
import { Search, Gamepad2, ShieldCheck } from 'lucide-react'
import ItemCard from './_ItemCard'
import type {
  ItemOffer,
  ItemsTaxonomy,
  ItemSort,
} from './_itemsTypes'
import { MultiSelectFilter, PriceRangeFilter, SingleSelectFilter, iconForFilter, titleCase } from './_ItemFilters'
import { parseDeliveryMinutes } from '@/lib/utils/delivery-time'

/** Local price formatter for stat chips (mirrors seo/page-stats without
 *  pulling that server-only module into this client component). */
function formatStatPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '0'
  if (price >= 1) return Number.isInteger(price) ? price.toFixed(0) : price.toFixed(2)
  return price.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

const PAGE_SIZE = 24

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
  gameImageUrl?: string | null
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
  gameImageUrl,
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
  const [page, setPage] = useState(1)

  // Reset pagination whenever filters change.
  useEffect(() => {
    setPage(1)
  }, [debouncedQ, attrFilters, priceRange, delivery, sort])

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

  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sort) {
      case 'price-asc':
        arr.sort((a, b) => a.pricePerUnit - b.pricePerUnit)
        break
      case 'price-desc':
        arr.sort((a, b) => b.pricePerUnit - a.pricePerUnit)
        break
      case 'top-rated':
        arr.sort((a, b) => (b.seller.ratingPercent ?? -1) - (a.seller.ratingPercent ?? -1))
        break
      case 'best-sellers':
        arr.sort((a, b) => b.seller.sales - a.seller.sales)
        break
      case 'recommended':
      default:
        arr.sort((a, b) => b.recommended - a.recommended)
    }
    return arr
  }, [filtered, sort])

  const visible = sorted.slice(0, page * PAGE_SIZE)
  const hasMore = sorted.length > visible.length

  // Best-deal showcase (Eldorado/G2G pattern): flag the single cheapest
  // in-stock offer in the current filtered set. Computed from `filtered`
  // (not `sorted`) so the flagged offer is stable no matter how the user
  // sorts. Only meaningful when there's more than one offer to compare.
  const bestDealId = useMemo(() => {
    const candidates = filtered.filter(
      (o) => o.pricePerUnit > 0 && (o.isUnlimited || (o.stock ?? 0) > 0),
    )
    if (candidates.length < 2) return null
    return candidates.reduce((best, o) =>
      o.pricePerUnit < best.pricePerUnit ? o : best,
    ).id
  }, [filtered])

  const clearFilters = () => {
    setQ('')
    setAttrFilters({})
    setPriceRange(null)
    setDelivery([])
    setSort('recommended')
  }

  return (
    <main className="min-h-screen">
      <SearchParamsBridge onParams={seedFromUrl} />
      {/* Filter band */}
      {/* V19/P24/P7.mm — Hero section bg removed so the body's violet
          gradient bleeds through. The hero is now a transparent
          layer with just a bottom hairline; matches the currency
          pages. */}
      {/* No bottom divider — the band ends with the filter row and the
          results start below it; a full-width rule added nothing. */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-5 pt-2 sm:px-6 sm:pb-6 sm:pt-3 lg:px-8">
          {/* V15s — Page header restored: big game logo on the left,
              single-line "{Game} Items" title beside it. Sits between
              the sub-nav and the filter row so the page has a proper
              entry point instead of dumping filters under the sub-nav. */}
          {/* Header — centered on mobile/tablet, left-aligned from md up.
              Roomier spacing so the logo, title and stats breathe. */}
          <div className="mb-5 flex flex-col items-center gap-4 text-center sm:mb-6 md:flex-row md:items-center md:gap-6 md:text-left">
            {gameImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={gameImageUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-2xl border border-border-default object-cover shadow-elevated sm:h-[72px] sm:w-[72px]"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border-default bg-bg-overlay text-lime-text shadow-elevated sm:h-[72px] sm:w-[72px]"
              >
                <Gamepad2 className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h1
                className="font-black leading-tight tracking-tight text-text-primary"
                style={{ fontSize: 'var(--fs-page-title)', lineHeight: 'var(--lh-page-title)', fontWeight: 'var(--fw-heading)', letterSpacing: '-0.02em' }}
              >
                {gameName} {categoryLabel}
              </h1>

              {/* Stats — floating text with dot separators (no cards).
                  Scannable + keyword-rich; full introLine stays in the HTML
                  (sr-only) for the crawler. */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-text-tertiary md:justify-start" style={{ fontSize: 'var(--fs-meta)' }}>
                <span>
                  <span className="font-bold tabular-nums text-text-primary">
                    {sorted.length.toLocaleString('en-US')}
                  </span>{' '}
                  {sorted.length === 1 ? 'listing' : 'listings'}
                </span>
                {stats?.lowPrice != null && (
                  <>
                    <Dot />
                    <span>
                      from{' '}
                      <span className="font-bold tabular-nums text-text-primary">
                        ${formatStatPrice(stats.lowPrice)}
                      </span>
                    </span>
                  </>
                )}
                {stats?.avgDeliveryLabel && (
                  <>
                    <Dot />
                    <span>~{stats.avgDeliveryLabel} delivery</span>
                  </>
                )}
                <Dot />
                <span className="inline-flex items-center gap-1 font-semibold text-[#7ec98f]">
                  <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
                  SafeDrop Protected
                </span>
              </div>
              {introLine && <p className="sr-only">{introLine}</p>}
            </div>
          </div>

          {/* Filter bar: search | filter chips | sort | clear.

              sm+: WRAPS onto a second row rather than scrolling. The old
              bar scrolled sideways with a hidden scrollbar, so a chip past
              the edge (e.g. Price) was simply cut off with no sign there
              was more.
              Mobile: still a horizontal scroller (wrapping would stack four
              rows of chips above the results), with the right edge faded
              out so it reads as "slides".

              Control height is raised HERE, not in tokens.css: the two
              height vars are overridden on this row and cascade to every
              control in it, so search, chips and sort stay one height and
              nothing else on the site changes. */}
          <div
            className="-mx-4 flex items-center gap-2.5 overflow-x-auto px-4 pb-0.5 [mask-image:linear-gradient(to_right,#000_82%,transparent)] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
            style={{ ['--h-input' as string]: '42px', ['--h-btn-secondary' as string]: '42px' }}
          >
            {/* Search — wider anchor on the left */}
            <div className="relative shrink-0 min-w-[220px] sm:min-w-[300px]">
              <Search
                // z-10: the input's backdrop-blur gives it its own layer, which
                // otherwise paints over this icon (it comes first in the DOM).
                className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-secondary"
                aria-hidden
              />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search for an Item"
                aria-label="Search for an item"
                // A recessed well, darker than the filter buttons beside it,
                // so the search reads as the place you type rather than one
                // more grey button. Interaction is an OUTLINE ONLY: hover
                // turns the border white; focus changes nothing (the caret is
                // the cue, and the site-wide green :focus-visible ring is
                // switched off here).
                className="w-full rounded border border-white/[0.13] bg-black/25 pl-10 pr-3 text-text-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] outline-none backdrop-blur-sm transition-colors placeholder:text-white/45 hover:border-white/40 focus-visible:shadow-none"
                style={{ height: 'var(--h-input)', fontSize: 'var(--fs-body)' }}
              />
            </div>

            {/* Attribute filters (admin-defined per game), then Price and
                Delivery Time. All multi-select except Price (a range). */}
            {visibleFilters.map((f) => (
              <MultiSelectFilter
                key={f.slug}
                label={titleCase(f.label)}
                icon={iconForFilter(f.label)}
                options={f.options}
                selected={getAttrFilter(f.slug)}
                onChange={(v) => setAttrFilter(f.slug, v)}
              />
            ))}
            {priceBounds[1] > priceBounds[0] && (
              <PriceRangeFilter bounds={priceBounds} value={priceRange} onChange={setPriceRange} />
            )}
            {deliveryOptions.length > 1 && (
              <MultiSelectFilter
                label="Delivery Time"
                icon={iconForFilter('delivery')}
                options={deliveryOptions}
                selected={delivery}
                onChange={setDelivery}
              />
            )}

            {/* Sort */}
            <div className="shrink-0">
              <SingleSelectFilter title="Sort By" options={SORT_OPTIONS} value={sort} onChange={setSort} />
            </div>

          </div>
        </div>
      </section>

      {/* Results + grid */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">

        {sorted.length === 0 ? (
          <EmptyState onClear={clearFilters} />
        ) : (
          <>
            {/* V15e — Landscape cards work best at 380px+ widths.
                Single column on mobile, two on tablet, three on desktop. */}
            {/* V15q — Wider gutter between cards. The previous gap-3/4
                made adjacent landscape cards touch their hover shadows
                and felt cramped. Now: gap-5 on mobile, gap-6 on sm+ so
                each card has breathing room horizontally AND vertically. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" style={{ gap: 'var(--gap-grid)' }}>
              {visible.map((o) => (
                <ItemCard
                  key={o.id}
                  offer={o}
                  gameSlug={gameSlug}
                  isOwn={!!viewerId && o.sellerId === viewerId}
                  isBestDeal={o.id === bestDealId}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-9 flex justify-center">
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-2 rounded border border-border-default bg-bg-raised px-6 font-bold text-text-primary transition-colors hover:border-lime-tint-border hover:bg-lime-tint-bg/30 hover:text-lime-text"
                  style={{ minHeight: 'var(--h-btn-primary)', fontSize: 'var(--fs-meta)' }}
                >
                  Load more items
                  <span aria-hidden className="text-text-tertiary">·</span>
                  <span className="text-text-tertiary tabular-nums">
                    {sorted.length - visible.length} left
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function Dot() {
  return <span aria-hidden className="text-text-disabled">·</span>
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-default bg-bg-raised px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border-default bg-bg-overlay text-text-secondary">
        <Search className="h-5 w-5" />
      </div>
      <h3 className="font-bold text-text-primary" style={{ fontSize: 'var(--fs-section)', lineHeight: 'var(--lh-section)' }}>
        No items match your filters
      </h3>
      <p className="mt-2 max-w-sm leading-relaxed text-text-secondary" style={{ fontSize: 'var(--fs-meta)', lineHeight: 'var(--lh-body)' }}>
        Try a different search, category, or type — or clear everything to see the full catalog.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-5 inline-flex items-center gap-1.5 rounded border border-border-default bg-bg-overlay px-4 font-semibold text-text-primary transition-colors hover:border-lime-tint-border hover:bg-lime-tint-bg/30 hover:text-lime-text"
        style={{ minHeight: 'var(--h-btn-primary)', fontSize: 'var(--fs-meta)' }}
      >
        Clear filters
      </button>
    </div>
  )
}
