/** Fixed targets for the GSC reports. */

/** Search Console property (a domain property: covers every protocol and subdomain). */
export const GSC_SITE = 'sc-domain:dropmarket.gg'
export const SITE_ORIGIN = 'https://dropmarket.gg'
export const SITEMAP_URL = `${SITE_ORIGIN}/sitemap.xml`

/** URL Inspection: 600/min and 2,000/day per property. 4 req/s = 240/min. */
export const REQUESTS_PER_SECOND = 4
/**
 * URL Inspection runs a live fetch: measured ~13 s per call (2026-10-01), so 4
 * workers managed 0.3 URL/s. 16 workers ≈ 1.7 URL/s — still far under the
 * 4 req/s pacing cap and 600/min quota, which the shared throttle enforces.
 */
export const DEFAULT_INDEX_CONCURRENCY = 16
export const DEFAULT_OUT_DIR = 'docs/audit/gsc'
