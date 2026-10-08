/**
 * Link to the founding-seller page with its attribution tag.
 *
 * The tag rides in the hash (`/early-seller#src=footer`), never the query:
 * robots.txt disallows `?src=` (duplicate-URL hygiene), and Bing reports every
 * internal link to a blocked URL as an error (2026-10-07 site scan: 16 pages).
 * Crawlers drop the hash, so every link is the one crawlable /early-seller.
 */
export function foundingHref(src: string): string {
  return `/early-seller#src=${encodeURIComponent(src)}`
}

/** The attribution tag on the current page: hash first, then a legacy `?src=`. */
export function readFoundingSrc(hash: string, search: URLSearchParams): string | undefined {
  const fromHash = new URLSearchParams(hash.replace(/^#/, '')).get('src')
  return fromHash || search.get('src') || undefined
}
