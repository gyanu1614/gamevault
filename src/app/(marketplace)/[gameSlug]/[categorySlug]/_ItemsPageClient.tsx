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
import { Search, Gamepad2, ShieldCheck, Store } from 'lucide-react'
import { track } from '@vercel/analytics'
import { track as phTrack } from '@/lib/analytics/client'
import { SellerPromptCard } from '@/components/seller/SellerPrompt'
import { useSellerPrompt } from '@/hooks/use-seller-prompt'
import { SELLER_PROMPT_EVENT, listingsEmptyCopy, sellerPromptHref } from '@/lib/seller/seller-prompt'
import { bestOfferId, sortOffers } from './_itemsSort'
import ItemCard from './_ItemCard'
import Link from 'next/link'
import { closestByName } from '@/lib/value-listings/closest'
import { ScrollRow } from '@/components/ui/scroll-row'
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

  // Best offer (cheapest in stock) is flagged on its card and pinned first
  // in the default order; see _itemsSort.ts. Computed from `filtered` so the
  // flag is stable whatever the sort.
  const bestDealId = useMemo(() => bestOfferId(filtered), [filtered])
  const sorted = useMemo(() => sortOffers(filtered, sort), [filtered, sort])

  const visible = sorted.slice(0, page * PAGE_SIZE)
  const hasMore = sorted.length > visible.length

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
          {/* Header — logo on the left, one-line "{Game} {Category}" title
              beside it, on every width (owner, 2026-09-28). The stats line
              stays in the HTML for search engines but is not shown. */}
          <div className="mb-5 flex flex-wrap items-center gap-3.5 sm:mb-6 sm:gap-5">
            {gameImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={gameImageUrl}
                alt={`${gameName} logo`}
                className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-[72px] sm:w-[72px]"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-bg-overlay text-lime-text sm:h-[72px] sm:w-[72px]"
              >
                <Gamepad2 className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {/* Game on top, small; the category is the big line — like
                  the homepage's "Every Gamer's Marketplace" split. The H1
                  still reads "{Game} {Category}" to crawlers: the game name
                  is inside it, visually hidden. */}
              <p className="mb-1.5 text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-text-secondary sm:text-[14px]">
                {gameName}
              </p>
              <h1
                className="font-black tracking-tight text-text-primary"
                style={{ fontSize: 'var(--fs-page-title)', lineHeight: 1.05, fontWeight: 'var(--fw-heading)', letterSpacing: '-0.02em' }}
              >
                <span className="sr-only">{gameName} </span>
                {categoryLabel}
              </h1>

              {/* Stats — kept in the HTML for crawlers (listing count, from
                  price, delivery, SafeDrop) but visually hidden: the owner
                  wants the header to be logo + game + category only. */}
              <div className="sr-only" style={{ fontSize: 'var(--fs-meta)' }}>
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
            {/* Seller prompt beside the title; its own row on phones. */}
            <SellerPromptCard gameName={gameName} categoryLabel={categoryLabel} className="w-full sm:ml-auto sm:w-auto sm:max-w-[520px]" />

          {/* Filter bar (owner, 2026-09-28): the filters on one full-width
              row, the search on its own full-width row below.

              Filters: sm+ they sit in one row at their natural width (wrapping
              when there are many); phones scroll them sideways, and ScrollRow
              fades the clipped edge with a ‹ / › chevron.

              Control height is set HERE, not in tokens.css: the two height
              vars are overridden on this block and cascade to every control
              in it, so search, chips and sort stay one height and nothing
              else on the site changes. */}
          {/* GameBoost sizing (measured 2026-09-29): 40px controls on phones,
              42px from sm; buttons as wide as their label, not stretched. */}
          <div className="[--h-btn-secondary:40px] [--h-input:40px] sm:[--h-btn-secondary:42px] sm:[--h-input:42px]">
          {/* Phones: the filters live in ONE bar exactly like the Messages
              tab bar (owner, 2026-09-30): well fill + hairline frame, 34px
              segments, the scroll cue inside the frame. sm+: loose pills. */}
          <div className="max-sm:w-fit max-sm:max-w-full max-sm:overflow-hidden max-sm:rounded-lg max-sm:border max-sm:border-white/[0.08] max-sm:bg-bg-well max-sm:[--h-btn-secondary:34px]">
          <ScrollRow
            edgeColor="var(--color-bg-well)"
            className="flex items-center overflow-x-auto [scrollbar-width:none] max-sm:w-max max-sm:max-w-full max-sm:gap-0.5 max-sm:p-0.5 sm:flex-wrap sm:gap-2 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
          >
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

            {/* Sort — a direct sibling of the filters (no wrapper), so the
                phone bar draws its divider like the others. */}
            <SingleSelectFilter title="Sort By" options={SORT_OPTIONS} value={sort} onChange={setSort} />
          </ScrollRow>
          </div>

          {/* Search — its own full-width row under the filters. */}
          <div className="relative mt-2.5 w-full">
            <Search
              // z-10: the input's backdrop-blur gives it its own layer, which
              // otherwise paints over this icon (it comes first in the DOM).
              className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-tertiary"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for an Item"
              aria-label="Search for an item"
              // Same family as the filter bar above: well fill + hairline.
              // Focus brightens the hairline (no green ring).
              className="w-full appearance-none rounded-lg border border-white/[0.08] bg-bg-well pl-10 pr-3 text-[16px] text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-white/[0.14] focus:border-white/25 focus-visible:shadow-none sm:text-[length:var(--fs-body)] [&::-webkit-search-cancel-button]:appearance-none"
              style={{ height: 'var(--h-input)' }}
            />
          </div>
          </div>
        </div>
      </section>

      {/* Results + grid */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">

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
              {visible.map((o) => (
                <ItemCard
                  key={o.id}
                  offer={o}
                  gameSlug={gameSlug}
                  gameName={gameName}
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
                  className="inline-flex items-center gap-2 rounded-md bg-bg-raised px-6 font-semibold text-text-primary transition-colors hover:bg-bg-raised-hover"
                  style={{ minHeight: 'var(--h-btn-primary)', fontSize: 'var(--fs-meta)' }}
                >
                  Load More Items
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
