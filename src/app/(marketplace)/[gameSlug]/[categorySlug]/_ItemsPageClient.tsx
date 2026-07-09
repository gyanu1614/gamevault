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

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, SlidersHorizontal, Gamepad2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import ItemCard from './_ItemCard'
import type {
  ItemOffer,
  ItemsTaxonomy,
  ItemSort,
  TaxonomyOption,
} from './_itemsTypes'
import { PRICE_BANDS } from './_itemsTypes'

const PAGE_SIZE = 24
const SORT_OPTIONS: { slug: ItemSort; label: string }[] = [
  { slug: 'recommended', label: 'Recommended' },
  { slug: 'price-asc', label: 'Price: Low to High' },
  { slug: 'price-desc', label: 'Price: High to Low' },
  { slug: 'top-rated', label: 'Top rated' },
  { slug: 'best-sellers', label: 'Most sales' },
]


interface ItemsPageClientProps {
  gameSlug: string
  gameName: string
  gameImageUrl?: string | null
  tagline?: string
  offers: ItemOffer[]
  taxonomy: ItemsTaxonomy
  viewerId?: string | null
  /** V21/P7.l — Category label for the header (e.g. "Items",
   *  "Accounts", "Boosting"). Defaults to "Items" for back-compat. */
  categoryLabel?: string
}

export default function ItemsPageClient({
  gameSlug,
  gameName,
  gameImageUrl,
  offers,
  taxonomy,
  viewerId,
  categoryLabel = 'Items',
}: ItemsPageClientProps) {
  // V14v — Scroll to top on mount before paint.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [])

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 200)
    return () => clearTimeout(t)
  }, [q])

  // V21/P7.v — Seed filters from the URL so a navbar search hit like
  // "garama" can deep-link to this page with the filter pre-applied:
  // /steal-a-brainrot/buy-items?attr_category=garama. We read each
  // `attr_<slug>` param and keep only those whose option actually exists
  // in this category's taxonomy (defensive against stale links).
  const searchParams = useSearchParams()
  const initialAttrFilters = useMemo(() => {
    const seeded: Record<string, string> = {}
    for (const f of taxonomy.filters ?? []) {
      const v = searchParams.get(`attr_${f.slug}`)
      if (v && f.options.some((o) => o.slug === v)) seeded[f.slug] = v
    }
    return seeded
    // Seed once from the initial params; subsequent filter changes are
    // local state, not URL-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // V15b — One filter value per attribute, keyed by attribute slug.
  // Default sentinel is 'all'. A filter is only "active" (i.e. applied
  // AND visible in the UI) when its value is not 'all'.
  const [attrFilters, setAttrFilters] = useState<Record<string, string>>(initialAttrFilters)
  const setAttrFilter = (slug: string, value: string) => {
    setAttrFilters((prev) => {
      const next = { ...prev, [slug]: value }
      // V15b — Reset descendants when a parent changes so stale child
      // selections don't silently filter out everything.
      if (taxonomy.filters) {
        for (const child of taxonomy.filters) {
          if (child.slug === slug) continue
          const dependsOnUs = child.conditionalRules.some(
            (r) => r.triggerAttrSlug === slug,
          )
          if (dependsOnUs) next[child.slug] = 'all'
        }
      }
      return next
    })
  }
  const getAttrFilter = (slug: string) => attrFilters[slug] ?? 'all'

  const [filterPrice, setFilterPrice] = useState<string>('any')
  const [sort, setSort] = useState<ItemSort>('recommended')
  const [page, setPage] = useState(1)

  // Reset pagination whenever filters change.
  useEffect(() => {
    setPage(1)
  }, [debouncedQ, attrFilters, filterPrice, sort])

  // V15b — Conditional-rule evaluator that runs against the CURRENT
  // filter state (not against a listing's data). Used to decide which
  // filter dropdowns to render. Mirrors the semantics of
  // isAttributeVisible() server-side.
  const isFilterVisible = (slug: string): boolean => {
    const attr = taxonomy.filters.find((f) => f.slug === slug)
    if (!attr) return false
    const rules = attr.conditionalRules
    if (rules.length === 0) return true
    for (const r of rules) {
      const parentValue = getAttrFilter(r.triggerAttrSlug)
      if (parentValue === 'all') return false
      const triggers = r.triggerValues
      let pass = false
      switch (r.operator) {
        case 'equals':     pass = triggers[0] === parentValue; break
        case 'not_equals': pass = triggers[0] !== parentValue; break
        case 'in':         pass = triggers.includes(parentValue); break
        case 'not_in':     pass = !triggers.includes(parentValue); break
      }
      if (!pass) return false
    }
    return true
  }

  const visibleFilters = useMemo(
    () => taxonomy.filters.filter((f) => isFilterVisible(f.slug)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taxonomy.filters, attrFilters],
  )

  const filtered = useMemo(() => {
    const band = PRICE_BANDS.find((b) => b.slug === filterPrice) ?? PRICE_BANDS[0]
    return offers.filter((o) => {
      // Apply every ACTIVE filter whose dropdown is currently visible.
      // Listings that are missing the attribute fall through (defensive —
      // legacy rows without template_data wouldn't be filtered out unless
      // the seller actively picks a value).
      for (const f of visibleFilters) {
        const v = getAttrFilter(f.slug)
        if (v === 'all') continue
        const listingValue = o.attributeValues[f.slug]
        if (!listingValue) return false
        if (Array.isArray(listingValue)) {
          if (!listingValue.includes(v)) return false
        } else if (listingValue !== v) {
          return false
        }
      }
      if (o.pricePerUnit < band.min) return false
      if (band.max !== null && o.pricePerUnit > band.max) return false
      if (debouncedQ) {
        const hay = `${o.name} ${o.seller.shopName || ''} ${o.seller.username}`.toLowerCase()
        if (!hay.includes(debouncedQ)) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers, attrFilters, filterPrice, debouncedQ, visibleFilters])

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
        arr.sort((a, b) => b.seller.rating - a.seller.rating)
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
    setFilterPrice('any')
    setSort('recommended')
  }

  const priceOptions: TaxonomyOption[] = PRICE_BANDS.map((b) => ({ slug: b.slug, label: b.label }))

  const findLabel = (opts: TaxonomyOption[], slug: string) =>
    opts.find((o) => o.slug === slug)?.label ?? slug

  return (
    <main className="min-h-screen">
      {/* Filter band */}
      {/* V19/P24/P7.mm — Hero section bg removed so the body's violet
          gradient bleeds through. The hero is now a transparent
          layer with just a bottom hairline; matches the currency
          pages. */}
      <section className="relative overflow-hidden border-b border-border-subtle">
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-5 pt-2 sm:px-6 sm:pb-6 sm:pt-3 lg:px-8">
          {/* V15s — Page header restored: big game logo on the left,
              single-line "{Game} Items" title beside it. Sits between
              the sub-nav and the filter row so the page has a proper
              entry point instead of dumping filters under the sub-nav. */}
          <div className="mb-4 flex items-center gap-4 sm:mb-5 sm:gap-5">
            {gameImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={gameImageUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-2xl border border-border-default object-cover shadow-elevated sm:h-16 sm:w-16"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border-default bg-bg-overlay text-lime-text shadow-elevated sm:h-16 sm:w-16"
              >
                <Gamepad2 className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text">
                Marketplace
              </div>
              <h1 className="mt-0.5 truncate text-[22px] font-black leading-tight tracking-tight text-text-primary sm:text-[28px] lg:text-[32px]">
                {gameName} {categoryLabel}
              </h1>
              {/* V15t — Item count moved into the subtitle so the page
                  has a single anchored block with title+count, then
                  filters+sort below. No more competing alignments. */}
              <div className="mt-0.5 text-[12.5px] text-text-tertiary">
                <span className="font-semibold tabular-nums text-text-secondary">
                  {sorted.length.toLocaleString('en-US')}
                </span>{' '}
                {sorted.length === 1 ? 'listing' : 'listings'} available
              </div>
            </div>
          </div>

          {/* V15t — Filter row, left-aligned. Filters on the left, Sort
              pinned to the right. Single consistent left edge from the
              page title to the cards below — same anchor that Skinport
              and Linear use. Mobile: filters as a 2-up grid, sort on its
              own line below. */}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-start sm:gap-2.5">
            {visibleFilters.map((f) => (
              <FilterSelect
                key={f.slug}
                label={f.label}
                value={getAttrFilter(f.slug)}
                defaultSlug="all"
                options={[
                  { slug: 'all', label: `All ${f.label.toLowerCase()}` },
                  ...f.options,
                ]}
                onChange={(v) => setAttrFilter(f.slug, v)}
              />
            ))}
            <FilterSelect
              label="Price"
              value={filterPrice}
              defaultSlug="any"
              options={priceOptions}
              onChange={setFilterPrice}
            />
            <button
              type="button"
              onClick={clearFilters}
              className="col-span-2 mt-0.5 h-9 px-1 text-left text-[12.5px] font-semibold text-text-tertiary underline decoration-border-default underline-offset-[3px] transition-colors hover:text-text-primary sm:col-span-1 sm:ml-1 sm:mt-0"
            >
              Clear filters
            </button>
            {/* Sort: pushed to the far right of the row on sm+ via ml-auto.
                On mobile it drops to its own row. */}
            <div className="col-span-2 sm:col-span-1 sm:ml-auto">
              <SortSelect value={sort} onChange={setSort} />
            </div>
          </div>

          {/* Search — left-aligned, full filter-row width */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items or sellers…"
              aria-label="Search items"
              className="h-11 w-full rounded-lg border border-border-default bg-bg-overlay px-4 pl-11 text-[14.5px] text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-lime focus:ring-2 focus:ring-lime-tint-bg sm:h-12 sm:text-[15px]"
            />
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
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
                  className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-bg-raised px-6 py-3 text-[14px] font-bold text-text-primary transition-colors hover:border-lime-tint-border hover:bg-lime-tint-bg/30 hover:text-lime-text"
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

  function FilterSelect({
    label,
    value,
    defaultSlug,
    options,
    onChange,
  }: {
    label: string
    value: string
    defaultSlug: string
    options: TaxonomyOption[]
    onChange: (slug: string) => void
  }) {
    return (
      <SearchableFilterChip
        label={label}
        value={value}
        defaultSlug={defaultSlug}
        options={options}
        onChange={onChange}
      />
    )
  }
}

/* ─── Searchable filter chip ────────────────────────────────────────────
   V15v — The trigger button IS the search input.
   - Closed: shows the selected label (or "All {label}") with a lime dot
     when active and an X clear button when active (or chevron when not).
   - Open: focuses the input, query starts empty, popover hangs below
     with the live-filtered options. cmdk under the hood for keyboard
     nav (arrows + enter + escape).
   - Pick an option → popover closes, chip shows the new label.
   - X button → resets value without opening.
   ─────────────────────────────────────────────────────────────────── */

interface SearchableFilterChipProps {
  label: string
  value: string
  defaultSlug: string
  options: TaxonomyOption[]
  onChange: (slug: string) => void
}

function SearchableFilterChip({
  label, value, defaultSlug, options, onChange,
}: SearchableFilterChipProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const isActive = value !== defaultSlug
  const selectedLabel = useMemo(
    () => options.find((o) => o.slug === value)?.label ?? value,
    [options, value],
  )
  const placeholder = open ? `Search ${label.toLowerCase()}…` : (isActive ? selectedLabel : `All ${label.toLowerCase()}`)

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const pick = (slug: string) => {
    onChange(slug)
    setOpen(false)
    inputRef.current?.blur()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    // V15w — Use Radix Popover.Root with Portal so the dropdown panel
    // renders at <body> root, escaping any parent stacking context that
    // would clip it or paint cards over it. Popover.Anchor binds the
    // panel's position to the input below; modal=false so focus stays
    // on the input as the user types.
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          // Defer to next tick so the input is mounted+visible before focusing.
          setTimeout(() => inputRef.current?.focus(), 0)
        }
      }}
    >
      <Popover.Anchor asChild>
        <div className="relative inline-flex h-11 w-full sm:w-auto sm:min-w-[170px]">
          {/* The input IS the trigger. Clicking it sets open=true via the
              onClick handler; Radix's Popover.Trigger is intentionally NOT
              used here so the input retains focus naturally. */}
          <input
            ref={inputRef}
            type="text"
            value={open ? query : ''}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label={`Filter by ${label}`}
            aria-expanded={open}
            aria-haspopup="listbox"
            className={cn(
              'h-11 w-full rounded-lg border border-border-default bg-bg-overlay pl-3.5 text-[14px] font-medium text-text-primary outline-none transition-colors',
              'hover:border-border-strong',
              'focus:border-lime focus:bg-bg-base focus:ring-2 focus:ring-lime-tint-bg',
              // V15x — Cursor: pointer when closed (acts as a button),
              // text-caret when open (acts as a search input).
              open ? 'cursor-text' : 'cursor-pointer',
              isActive && !open
                ? 'placeholder:text-text-primary placeholder:font-medium'
                : 'placeholder:text-text-tertiary',
              isActive && !open && 'border-lime-tint-border bg-lime-tint-bg/30',
              isActive && !open ? 'pl-7' : 'pl-3.5',
              'pr-9',
            )}
          />
          {isActive && !open && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-lime"
            />
          )}
          {isActive ? (
            <button
              type="button"
              aria-label={`Clear ${label} filter`}
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onChange(defaultSlug)
                setOpen(false)
              }}
              className="absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border-subtle bg-bg-base/60 text-text-secondary transition-colors hover:border-error/40 hover:bg-error-bg hover:text-error"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <ChevronDown
              aria-hidden
              className={cn(
                'pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary transition-transform',
                open && 'rotate-180 text-text-secondary',
              )}
            />
          )}
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          // Don't steal focus from the input on open/close.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          // Don't close when the input below receives a pointer (the
          // input is OUTSIDE the Content, so Radix would otherwise treat
          // its clicks as "outside" and close).
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement
            if (target === inputRef.current || inputRef.current?.contains(target)) {
              e.preventDefault()
            }
          }}
          // Same guard for focus moving out — keep panel open while the
          // input is focused.
          onFocusOutside={(e) => {
            if (document.activeElement === inputRef.current) {
              e.preventDefault()
            }
          }}
          className={cn(
            // z-[60] guarantees the panel paints above sticky nav, sticky
            // sub-nav, and any z-50 sibling. Portal already takes it out
            // of the cards' stacking context.
            'z-[60] overflow-hidden rounded-lg border border-border-default bg-bg-overlay shadow-[0_16px_40px_rgba(0,0,0,0.5)]',
            'min-w-[var(--radix-popover-trigger-width,220px)]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
        >
          <div className="max-h-[280px] overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[12px] text-text-tertiary">
                No matches for &quot;{query}&quot;
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {filtered.map((o) => {
                  const selected = o.slug === value
                  return (
                    <button
                      key={o.slug}
                      type="button"
                      onClick={() => pick(o.slug)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium transition-colors',
                        selected
                          ? 'bg-bg-raised-hover text-text-primary'
                          : 'text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary',
                      )}
                    >
                      <span className="truncate">{o.label}</span>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-lime-text" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function SortSelect({
  value,
  onChange,
}: {
  value: ItemSort
  onChange: (s: ItemSort) => void
}) {
  const label = SORT_OPTIONS.find((s) => s.slug === value)?.label ?? 'Sort'
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-subtle bg-transparent px-3.5 text-[13.5px] font-semibold text-text-primary transition-colors hover:border-border-default"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-text-tertiary" aria-hidden />
          {label}
          <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="end"
          className={cn(
            'z-50 min-w-[210px] rounded-lg border border-border-default bg-bg-overlay p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.5)]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
        >
          <div className="flex flex-col gap-0.5">
            {SORT_OPTIONS.map((o) => {
              const selected = o.slug === value
              return (
                <Popover.Close key={o.slug} asChild>
                  <button
                    type="button"
                    onClick={() => onChange(o.slug)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium transition-colors',
                      selected
                        ? 'bg-bg-raised-hover text-text-primary'
                        : 'text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary',
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {selected && <Check className="h-3.5 w-3.5 shrink-0 text-lime-text" />}
                  </button>
                </Popover.Close>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-default bg-bg-raised px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border-default bg-bg-overlay text-text-secondary">
        <Search className="h-5 w-5" />
      </div>
      <h3 className="text-[17px] font-bold text-text-primary">
        No items match your filters
      </h3>
      <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-text-secondary">
        Try a different search, category, or type — or clear everything to see the full catalog.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg border border-border-default bg-bg-overlay px-4 text-[13.5px] font-semibold text-text-primary transition-colors hover:border-lime-tint-border hover:bg-lime-tint-bg/30 hover:text-lime-text"
      >
        Clear filters
      </button>
    </div>
  )
}
