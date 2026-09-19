import { expandSearchWithSynonyms } from '@/lib/utils/gaming-synonyms'

/**
 * Filter / sort / paginate the generic category grid on the CLIENT.
 *
 * Step 7a — the page used to run these rules server-side from `searchParams`
 * (a PostgREST query per request), which made the route dynamic. The ISR page
 * now ships the full active set for the category and this applies the same
 * rules in the browser. Each rule mirrors what the query did:
 *
 *   minPrice/maxPrice  price gte/lte (a non-numeric bound errored the query,
 *                      which yielded an empty grid — kept)
 *   search             .or(title.ilike.%t%, description.ilike.%t%) over the
 *                      synonym-expanded terms
 *   type               title.ilike.%<type with - as space>%
 *   delivery           delivery_time in (a,b,…)
 *   sort               price asc/desc · view_count desc · created_at desc,
 *                      with Postgres null placement (asc → last, desc → first)
 *   tiers/online       JS post-filters on the embedded seller (unchanged)
 *   page               cumulative slice(0, page*12) — the load-more model
 */
export const LISTINGS_PER_PAGE = 12

export interface GenericListing {
  id: string
  title: string
  description?: string | null
  price: number
  view_count?: number | null
  created_at?: string | null
  delivery_time?: string | null
  seller?: {
    seller_tier?: string | null
    presence?: { is_online?: boolean | null } | null
  } | null
  [key: string]: unknown
}

export interface GenericListingView<T extends GenericListing> {
  listings: T[]
  hasMore: boolean
  currentPage: number
  totalListings: number
  /** Dearest price on the returned page (the slider ceiling), 1000 when empty. */
  maxPrice: number
  activeType: string | null
}

type Getter = (key: string) => string | null

/** Postgres ORDER BY null placement: ASC → NULLS LAST, DESC → NULLS FIRST. */
function compareNullable(a: number | null | undefined, b: number | null | undefined, ascending: boolean) {
  const an = a == null, bn = b == null
  if (an && bn) return 0
  if (an) return ascending ? 1 : -1
  if (bn) return ascending ? -1 : 1
  return ascending ? (a as number) - (b as number) : (b as number) - (a as number)
}

function includesCi(haystack: string | null | undefined, needle: string) {
  return (haystack ?? '').toLowerCase().includes(needle.toLowerCase())
}

export function applyCategoryListingParams<T extends GenericListing>(
  all: readonly T[],
  get: Getter,
): GenericListingView<T> {
  const minPrice = get('minPrice')
  const maxPrice = get('maxPrice')
  const search = get('search')
  const type = get('type')
  const delivery = get('delivery')
  const sort = get('sort')
  const tiers = get('tiers')
  const online = get('online')
  const pageRaw = parseInt(get('page') || '1', 10)
  const currentPage = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1

  let rows: T[] = [...all]

  // A bound that is not a number made the PostgREST query fail, and the page
  // rendered an empty grid. Same outcome here.
  const min = minPrice ? parseFloat(minPrice) : null
  const max = maxPrice ? parseFloat(maxPrice) : null
  if ((min != null && Number.isNaN(min)) || (max != null && Number.isNaN(max))) {
    rows = []
  } else {
    if (min != null) rows = rows.filter((l) => l.price >= min)
    if (max != null) rows = rows.filter((l) => l.price <= max)
  }

  if (search) {
    const terms = expandSearchWithSynonyms(search)
    rows = rows.filter((l) =>
      terms.some((t) => includesCi(l.title, t) || includesCi(l.description, t)),
    )
  }

  if (type) {
    const label = type.replace(/-/g, ' ')
    rows = rows.filter((l) => includesCi(l.title, label))
  }

  if (delivery) {
    const allowed = new Set(delivery.split(','))
    rows = rows.filter((l) => allowed.has(l.delivery_time ?? ''))
  }

  switch (sort) {
    case 'price_low':
      rows.sort((a, b) => compareNullable(a.price, b.price, true))
      break
    case 'price_high':
      rows.sort((a, b) => compareNullable(a.price, b.price, false))
      break
    case 'popular':
      rows.sort((a, b) => compareNullable(a.view_count, b.view_count, false))
      break
    default:
      rows.sort((a, b) =>
        compareNullable(
          a.created_at ? Date.parse(a.created_at) : null,
          b.created_at ? Date.parse(b.created_at) : null,
          false,
        ),
      )
  }

  if (tiers) {
    const wanted = tiers.split(',')
    rows = rows.filter((l) => wanted.includes(l.seller?.seller_tier ?? ''))
  }
  if (online === 'true') {
    rows = rows.filter((l) => l.seller?.presence?.is_online === true)
  }

  const totalListings = rows.length
  const endIndex = currentPage * LISTINGS_PER_PAGE
  const page = rows.slice(0, endIndex)

  return {
    listings: page,
    hasMore: endIndex < totalListings,
    currentPage,
    totalListings,
    maxPrice: page.length > 0 ? Math.max(...page.map((l) => l.price)) : 1000,
    activeType: type || null,
  }
}
