/** Filters as short address values. No React here, so a page's own read and its tests share them. */

export type FilterValues = Record<string, string | null>

/** A list as one value: `a,b`, or nothing when it's empty. */
export const listParam = (values: readonly string[]): string | null => (values.length > 0 ? values.join(',') : null)
export const readList = (params: URLSearchParams, key: string): string[] => params.get(key)?.split(',').filter(Boolean) ?? []

/** The query string with these values set, and the ones without a value removed. Everything else stays (`page`). */
export function withFilterParams(search: string, values: FilterValues): string {
  const params = new URLSearchParams(search)
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value)
    else params.delete(key)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** The address's values that this page still offers. An old link can name a filter that has gone. */
export function readAllowed<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T[] {
  return readList(params, key).filter((v): v is T => (allowed as readonly string[]).includes(v))
}

export function readOne<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[], fallback: T): T {
  const value = params.get(key)
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/** A price range as one value: `5-40`. */
export const priceParam = (range: readonly [number, number] | null): string | null => (range ? `${range[0]}-${range[1]}` : null)

/** Kept inside the page's own limits, because prices move between visits. */
export function readPriceParam(params: URLSearchParams, key: string, bounds: readonly [number, number]): [number, number] | null {
  const [lo, hi] = (params.get(key) ?? '').split('-').map(Number)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null
  const from = Math.max(lo, bounds[0])
  const to = Math.min(hi, bounds[1])
  return from < to ? [from, to] : null
}
