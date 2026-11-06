import { listParam, priceParam, readAllowed, readOne, readPriceParam, type FilterValues } from '@/lib/navigation/filter-params'
import type { GridSort } from './grid'

const SORTS: readonly GridSort[] = ['recommended', 'cheapest', 'priciest']

/** What the Items page shows, as it goes in its address. */
export interface GridAddress<L extends string = string> {
  q: string
  sort: GridSort
  rarities: string[]
  types: string[]
  /** Adopt Me's N / M / F / R letters. */
  letters: L[]
  /** Other games' traits, by name. */
  forms: string[]
  price: [number, number] | null
}

export function gridAddressValues(a: GridAddress): FilterValues {
  return {
    q: a.q.trim() || null,
    // Old value-page links used this name for the search; it becomes `q` on the first write.
    search: null,
    sort: a.sort === 'recommended' ? null : a.sort,
    rarity: listParam(a.rarities),
    type: listParam(a.types),
    trait: listParam(a.letters),
    form: listParam(a.forms),
    price: priceParam(a.price),
  }
}

export function readGridAddress<L extends string>(
  params: URLSearchParams,
  allowed: { rarities: readonly string[]; types: readonly string[]; letters: readonly L[]; forms: readonly string[]; bounds: readonly [number, number] },
): GridAddress<L> {
  return {
    q: (params.get('q') ?? params.get('search') ?? '').trim(),
    sort: readOne(params, 'sort', SORTS, 'recommended'),
    rarities: readAllowed(params, 'rarity', allowed.rarities),
    types: readAllowed(params, 'type', allowed.types),
    letters: readAllowed(params, 'trait', allowed.letters),
    forms: readAllowed(params, 'form', allowed.forms),
    price: readPriceParam(params, 'price', allowed.bounds),
  }
}
