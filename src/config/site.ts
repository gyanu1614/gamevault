/**
 * site — the canonical public identity of the site.
 *
 * SITE_URL is the CANONICAL domain (SEO: canonicals, Open Graph,
 * sitemap, robots, JSON-LD, share/referral links). It deliberately does
 * NOT follow NEXT_PUBLIC_APP_URL: that var is deployment-specific
 * (ngrok in dev, the deploy host in prod) and is used for callbacks,
 * auth redirects, and email links — surfaces that must hit the running
 * deployment. Canonical metadata must always declare dropmarket.gg,
 * even when the same build serves transition domains (arcadeshop.io).
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dropmarket.gg'
export const SITE_NAME = 'DropMarket'
