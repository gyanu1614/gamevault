/**
 * Query params that never create a distinct, indexable page.
 *
 * Every public page canonicalises to its clean path (root layout sets
 * `alternates.canonical = './'`), so a URL carrying one of these renders the
 * same content as a page Google already has. robots.txt reads this list so
 * crawl budget is not spent re-fetching them; the pages stay reachable for
 * visitors. Add a param here when a new filter, sort or tracking param ships.
 *
 * `search` and `q` were once left open on purpose, because item-filtered
 * buy-items deep links (internal links) carry them. Those links still work for
 * visitors; blocking only stops the crawl of a URL that canonicalises to the
 * clean page anyway (2026-10-02 crawl audit).
 */
export const NON_CANONICAL_PARAMS = [
  // Next.js prefetch payloads (`?_rsc=`): 26% of Google's requests, 96% refresh.
  '_rsc',
  // Sorting, paging, search.
  'sort', 'sortBy', 'page', 'search', 'q', 'view',
  // Facets on category grids and the value hubs.
  // `obtain` is what the SAB client emits; `obtainability` is kept for old links.
  'rarity', 'obtainability', 'obtain', 'type', 'minPrice', 'maxPrice', 'delivery', 'tiers', 'online',
  'variant', 'mutation', 'pet', 'brainrot',
  // Calculator tab and /browse filters.
  'tab', 'game', 'category',
  // Attribution and post-login return paths.
  'src', 'ref', 'redirect',
] as const

/** Whole families of params (`utm_source`, `attr_rarity`, ...). */
export const NON_CANONICAL_PARAM_PREFIXES = ['utm_', 'attr_'] as const

/** robots.txt `Disallow` lines: the `?` and `&` forms of each param. */
export function paramDisallowRules(): string[] {
  const rules: string[] = []
  for (const p of NON_CANONICAL_PARAMS) rules.push(`/*?${p}=`, `/*&${p}=`)
  for (const p of NON_CANONICAL_PARAM_PREFIXES) rules.push(`/*?${p}`, `/*&${p}`)
  return rules
}
