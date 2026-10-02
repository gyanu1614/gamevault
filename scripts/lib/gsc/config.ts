/** Fixed targets for the GSC reports. */

/** Search Console property (a domain property: covers every protocol and subdomain). */
export const GSC_SITE = 'sc-domain:dropmarket.gg'
export const SITE_ORIGIN = 'https://dropmarket.gg'
export const SITEMAP_URL = `${SITE_ORIGIN}/sitemap.xml`

/** URL Inspection: 600/min and 2,000/day per property. 4 req/s = 240/min. */
export const REQUESTS_PER_SECOND = 4
export const DEFAULT_OUT_DIR = 'docs/audit/gsc'
