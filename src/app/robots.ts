/**
 * Robots.txt Generator
 *
 * Controls search engine crawling
 */

import { MetadataRoute } from 'next'

import { SITE_URL } from '@/config/site'

const BASE_URL = SITE_URL

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/account/dashboard/',
          '/account/orders/',
          '/account/listings/edit/',
          '/orders/',
          '/purchases/',
          '/wallet/',
          '/wishlist/',
          '/checkout/',
          // Internal design previews. ROUTE-002 gated them server-side (they
          // 404 on the live site via src/app/dev/layout.tsx), but the disallow
          // stays: it governs crawling on preview deployments, where the pages
          // do render, and the two are not substitutes for one another.
          '/dev/',
          // Parameterized duplicates: sorted views and campaign-tagged
          // URLs render the same content as the canonical page.
          '/*?sort=',
          '/*&sort=',
          '/*?utm_',
          '/*&utm_',
          // Faceted filter params (rarity / obtainability on the SAB values
          // directory, attribute filters + pagination on category pages).
          // Each renders a filtered SLICE of a page Google already has via the
          // clean URL — crawling them wastes budget on a new domain and creates
          // near-duplicates. The canonical (no-param) page carries the content.
          // NOTE: `?search=` is deliberately NOT blocked — item-filtered
          // buy-items deep links (our internal-link targets) use it on purpose.
          '/*?rarity=',
          '/*&rarity=',
          '/*?obtainability=',
          '/*&obtainability=',
          '/*?attr_',
          '/*&attr_',
          '/*?page=',
          '/*&page=',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
