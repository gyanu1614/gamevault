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
          // Parameterized duplicates: sorted views and campaign-tagged
          // URLs render the same content as the canonical page.
          '/*?sort=',
          '/*&sort=',
          '/*?utm_',
          '/*&utm_',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
