'use client'

/**
 * Adopt Me value list — the dual-axis pillar page.
 *
 * Adopt Me's price dimension is the 8-form potion/Neon ladder, chosen with a
 * VARIANT SELECTOR that reprices the whole list (and per card). Every card
 * shows BOTH numbers — community trade value and the cheapest reputable cash
 * price. Built on the shared values kit (src/components/values) so it reads
 * as one product with the other hubs.
 */

import { Suspense, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SortAscendingIcon } from '@phosphor-icons/react/dist/csr/SortAscending'
import { VARIANT_LABEL, type Variant } from '../calculator/_adoptMeCalcTypes'
import { variantColor } from './[itemSlug]/_adoptMeVariantColor'
import { CompactVariantPicker } from './_CompactVariantPicker'
import {
  CardPickerOverlay,
  CardRank,
  PopularTag,
  PriceStatPair,
  RarityLabel,
  ValueCard,
  VariantPill,
} from '@/components/values/ValueCard'
import { ValueSearchField } from '@/components/values/ValueSearchField'
import { ValueSelect } from '@/components/values/ValueSelect'
import { ValuePopoverField } from '@/components/values/ValuePopoverField'
import { ValuePagination } from '@/components/values/ValuePagination'
import { RarityFilterBar } from '@/components/values/RarityFilterBar'
import { ValuesEmptyState } from '@/components/values/ValuesEmptyState'
import { MARKET_SECONDARY_GAP } from '@/lib/values/pricing'
import { ADOPT_ME_RARITIES, rarityMeta as sharedRarityMeta } from '@/lib/values/rarity'
import type { InitialValueList } from '@/lib/values/lazy-list'
import { useValueListRows } from '@/lib/values/useValueListRows'
import { VALUE_BTN_SECONDARY } from '@/components/values/styles'
import { ValueCardSkeleton } from './_generic/ValueListSkeleton'
import {
  ADOPT_ME_DEFAULT_SORT,
  ADOPT_ME_DEFAULT_VARIANT,
  ADOPT_ME_DEFAULT_VIEW,
  ADOPT_ME_PAGE_SIZE,
  filterSortPets,
  popularPetSlugs,
  type AdoptMePetItem,
  type AdoptMeSort,
  type AdoptMeView,
} from './_adoptMeListModel'

export type { AdoptMePetItem, AdoptMeVariantValue } from './_adoptMeListModel'

const rarityMeta = (r: string) => sharedRarityMeta('adopt-me', r)
const RARITY_ORDER = ADOPT_ME_RARITIES.map((r) => r.key)

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const TRADE = new Intl.NumberFormat('en-US')


const PAGE_SIZE = ADOPT_ME_PAGE_SIZE

type View = AdoptMeView
type Sort = AdoptMeSort

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: 'value-desc', label: 'Highest Trade Value' },
  { value: 'value-asc', label: 'Lowest Trade Value' },
  { value: 'cash-desc', label: 'Highest Cash Price' },
  { value: 'cash-asc', label: 'Lowest Cash Price' },
  { value: 'name', label: 'Name (A–Z)' },
]

// useSearchParams() requires a Suspense boundary; the wrapper provides it so the
// page can render this client directly (mirrors SAB's ValuesDirectoryClient).
export default function AdoptMeValuesClient({ initial }: { initial: InitialValueList }) {
  return (
    <Suspense fallback={null}>
      <AdoptMeValuesClientInner initial={initial} />
    </Suspense>
  )
}

function AdoptMeValuesClientInner({ initial }: { initial: InitialValueList }) {
  // The default view's first page ships in the page; every pet arrives from
  // rows.json right after hydration (lib/values/lazy-list.ts — the full list
  // made this page 1.2 MB).
  const { rows: pets, ready, failed, retry } = useValueListRows<AdoptMePetItem>('adopt-me', initial)
  // Filters live in the URL so they SURVIVE navigation: tap a pet, hit Back, and
  // the same variant/search/view/sort/page is restored (and the view is
  // shareable/bookmarkable). Seeded from the query params on mount; a sync effect
  // mirrors changes back via replace(). Matches SAB's directory client exactly.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [variant, setVariant] = useState<Variant>(
    () => (searchParams.get('variant') as Variant) ?? 'FR',
  )
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [view, setView] = useState<View>(
    () => (searchParams.get('view') as View) ?? 'popular',
  )
  const [sort, setSort] = useState<Sort>(
    () => (searchParams.get('sort') as Sort) ?? 'value-desc',
  )
  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get('page'))
    return Number.isInteger(p) && p > 0 ? p : 1
  })

  // The top few by demand get a "Popular" tag (from the page until all pets are here).
  const popularSlugs = useMemo(
    () => new Set(ready ? popularPetSlugs(pets) : ((initial.extra?.popular as string[] | undefined) ?? [])),
    [pets, ready, initial.extra],
  )

  // Per-rarity counts for the tab labels (Legendary 42, Ultra-Rare 11…).
  const rarityCounts = useMemo(() => {
    if (!ready) return initial.facets.rarity ?? {}
    const m: Record<string, number> = {}
    for (const p of pets) m[p.rarity] = (m[p.rarity] ?? 0) + 1
    return m
  }, [pets, ready, initial.facets])

  const raritiesPresent = useMemo(() => RARITY_ORDER.filter((r) => (rarityCounts[r] ?? 0) > 0), [rarityCounts])

  const valueOf = (p: AdoptMePetItem) => p.values[variant]

  const isDefaultView =
    !query.trim() &&
    variant === ADOPT_ME_DEFAULT_VARIANT &&
    view === ADOPT_ME_DEFAULT_VIEW &&
    sort === ADOPT_ME_DEFAULT_SORT &&
    page === 1
  // Before the full list arrives only the default first page is known; any
  // other view waits for it rather than filtering one page.
  const pending = !ready && !isDefaultView
  const filtered = useMemo(
    () => (ready ? filterSortPets(pets, { query, view, sort, variant }) : pets),
    [pets, ready, query, view, sort, variant],
  )
  const filteredCount = ready ? filtered.length : initial.total

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visible = ready ? filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE) : pending ? [] : filtered
  const resetPage = () => setPage(1)
  // Paging scrolls back to the top so the new page isn't stranded below the
  // pagination bar. Instant for reduced-motion users.
  const goToPage = (next: number) => {
    setPage(next)
    if (typeof window === 'undefined') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  const rangeStart = filteredCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredCount)

  // Mirror the current variant/filter/sort/page into the URL (replace, so typing
  // doesn't spam history). Because the state lives in the URL, tapping a pet and
  // hitting Back restores exactly this view. Only non-default values are written,
  // keeping the URL clean on the landing view.
  useEffect(() => {
    const params = new URLSearchParams()
    if (variant !== 'FR') params.set('variant', variant)
    if (query.trim()) params.set('q', query.trim())
    if (view !== 'popular') params.set('view', view)
    if (sort !== 'value-desc') params.set('sort', sort)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    if (qs !== searchParams.toString()) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }, [variant, query, view, sort, page, pathname, router, searchParams])

  const rarityOptions = [
    { key: 'popular', label: 'Popular', color: '#4FB477' },
    { key: 'all', label: 'All', color: '#9AA6A0', count: ready ? pets.length : initial.total },
    ...raritiesPresent.map((r) => ({
      key: r,
      label: rarityMeta(r).label,
      color: rarityMeta(r).color,
      count: rarityCounts[r] ?? 0,
    })),
  ]

  return (
    <div>
      {/* Toolbar: search grows, variant + sort beside it; rarity tiles below. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <ValueSearchField
          className="flex-1"
          value={query}
          onChange={(v) => { setQuery(v); resetPage() }}
          placeholder="Search a pet by name…"
          label="Search pets"
        />
        <div className="w-full shrink-0 sm:w-48">
          <ValuePopoverField
            label="Choose variant for the whole list"
            trigger={
              <>
                <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[11px] font-semibold text-text-primary">{variant}</span>
                <span className="truncate">{VARIANT_LABEL[variant]}</span>
              </>
            }
          >
            {() => (
              // Every form is a valid whole-list view (unpriced forms fall back
              // to trade value), so nothing is disabled.
              <CompactVariantPicker variant={variant} onChange={setVariant} accent="#4FB477" />
            )}
          </ValuePopoverField>
        </div>
        <div className="w-full shrink-0 sm:w-56">
          <ValueSelect
            value={sort}
            onChange={(v) => { setSort(v); resetPage() }}
            options={SORT_OPTIONS}
            label="Sort pets"
            icon={<SortAscendingIcon size={16} weight="bold" />}
          />
        </div>
      </div>

      <div className="mt-2">
        <RarityFilterBar
          options={rarityOptions}
          value={view}
          onChange={(k) => { setView(k); resetPage() }}
        />
      </div>

      {variant !== 'FR' && (
        <p className="mt-2 text-caption text-text-tertiary">Fly Ride (FR) is the standard trading benchmark.</p>
      )}

      <p className="mt-3 text-sm text-text-secondary">
        {pending ? (
            <>Loading every pet…</>
          ) : (
            <>
Showing{' '}
        <span className="font-semibold tabular-nums text-text-primary">
          {filteredCount === 0 ? '0' : `${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()}`}
        </span>{' '}
        of <span className="tabular-nums">{filteredCount.toLocaleString()}</span> pets
            </>
          )}
      </p>

      {pending && failed ? (
        <ValuesEmptyState
          className="mt-6"
          title="Couldn't Load Every Pet"
          body="Check your connection and try again."
          action={
            <button type="button" onClick={retry} className={`mt-5 ${VALUE_BTN_SECONDARY}`}>
              Try Again
            </button>
          }
        />
      ) : pending ? (
        <div aria-busy aria-label="Loading pets" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <ValueCardSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <ValuesEmptyState className="mt-6" title="No Pets Found" body="Try changing the search or filters." />
      ) : (
        // Each card carries its own variant picker that reprices its footer,
        // independent of the list-wide selector.
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((p, i) => (
            <PetCard
              key={p.slug}
              pet={p}
              rank={(safePage - 1) * PAGE_SIZE + i + 1}
              isPopular={popularSlugs.has(p.slug)}
              tableVariant={variant}
            />
          ))}
        </div>
      )}

      <ValuePagination page={safePage} totalPages={totalPages} onPage={goToPage} />

      <p className="mt-8 border-t border-white/[0.07] pt-5 text-[12px] leading-relaxed text-text-tertiary">
        Prices come from active listings by reputable sellers. Bundles, account
        sales and disputed orders are excluded. Cash values marked “Est.” are derived
        from the variant ladder until we hold enough real sales; change indicators
        appear only where we hold enough price history.
      </p>
    </div>
  )
}

/**
 * One pet card on the shared ValueCard. Seeds its variant from the list-wide
 * selector but can be repriced on its own via the in-card picker; art/name and
 * footer link to the pet page only when one exists (never a 404 link).
 */
function PetCard({
  pet,
  rank,
  isPopular,
  tableVariant,
}: {
  pet: AdoptMePetItem
  rank: number
  isPopular: boolean
  tableVariant: Variant
}) {
  const [code, setCode] = useState<Variant>(tableVariant)
  const [pickerOpen, setPickerOpen] = useState(false)
  // Follow the table-wide selector when it changes.
  useEffect(() => setCode(tableVariant), [tableVariant])

  const v = pet.values[code]
  const meta = rarityMeta(pet.rarity)
  const c = variantColor(code)
  const cheapest = v?.cheapestUsd ?? v?.cashUsd ?? null
  const showTypical =
    v?.cheapestUsd != null &&
    v?.averageUsd != null &&
    v.averageUsd > v.cheapestUsd * MARKET_SECONDARY_GAP
  const tradeVal = v?.tradeValue ?? null

  const href = pet.hasPage
    ? code === 'FR'
      ? `/adopt-me/values/${pet.slug}`
      : `/adopt-me/values/${pet.slug}?variant=${code}`
    : null

  return (
    <ValueCard
      href={href}
      headerLeft={
        <>
          <CardRank rank={rank} />
          {isPopular && <PopularTag />}
        </>
      }
      headerRight={<RarityLabel label={meta.label} color={meta.color} />}
      imageSrc={pet.imageUrl}
      imageAlt={`${pet.name} in Adopt Me`}
      name={pet.name}
      control={
        <VariantPill
          label={VARIANT_LABEL[code]}
          color={c}
          expanded={pickerOpen}
          onToggle={() => setPickerOpen((o) => !o)}
          ariaLabel={`Variant: ${VARIANT_LABEL[code]}. Change variant`}
        />
      }
      footer={
        <PriceStatPair
          stats={[
            { label: 'Trade', value: tradeVal != null ? TRADE.format(tradeVal) : null, color: '#E8BD6A' },
            {
              label: 'Cheapest',
              value: cheapest != null ? USD.format(cheapest) : null,
              color: '#54DDBE',
              sub: showTypical ? `~${USD.format(v!.averageUsd as number)}` : undefined,
            },
          ]}
        />
      }
      overlay={
        <CardPickerOverlay open={pickerOpen} title="Choose Variant" onClose={() => setPickerOpen(false)}>
          <div className="flex flex-1 flex-col justify-center">
            <CompactVariantPicker variant={code} onChange={setCode} accent={c} />
          </div>
        </CardPickerOverlay>
      }
    />
  )
}
