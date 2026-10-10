/**
 * Robots.txt Generator
 *
 * Controls search engine crawling
 */

import { MetadataRoute } from 'next'

import { SITE_URL } from '@/config/site'
import { paramDisallowRules } from '@/lib/seo/crawl-params'

const BASE_URL = SITE_URL

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // /_next/ stays fetchable: Next image URLs carry `&q=`, a blocked param,
        // and the longest matching rule wins, so this beats the param rules.
        allow: ['/', '/_next/'],
        disallow: [
          '/api/',
          '/admin/',
          '/account/dashboard/',
          '/account/orders/',
          '/account/listings/edit/',
          '/orders/',
          '/purchases/',
          '/wallet/',
          '/checkout/',
          // Seller/admin view of a non-live listing (session-only, noindex).
          '/listing-preview/',
          // Internal design previews. ROUTE-002 gated them server-side (they
          // 404 on the live site via src/app/dev/layout.tsx), but the disallow
          // stays: it governs crawling on preview deployments, where the pages
          // do render, and the two are not substitutes for one another.
          '/dev/',
          // Parameterized duplicates (sort, paging, filters, search, tracking,
          // Next.js `?_rsc=` prefetch payloads). Each renders the same content
          // as the clean canonical URL. ONE list: src/lib/seo/crawl-params.ts.
          ...paramDisallowRules(),
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
