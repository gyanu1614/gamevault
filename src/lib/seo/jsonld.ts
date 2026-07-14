/**
 * jsonld — Schema.org builders for money pages.
 *
 * Every builder returns a plain object; render it in the initial HTML
 * via the <JsonLd data={...}/> server-component helper below (a
 * <script type="application/ld+json"> tag). All URLs are absolute via
 * SITE_URL (the canonical domain) — never a deployment host.
 *
 * Integrity rules the callers must uphold:
 * - productAggregate: caller guarantees offerCount > 0 (never emit an
 *   AggregateOffer with zero offers).
 * - faqPage: only pass Q&As that are actually rendered on the page.
 * - Never fabricate ratings — there is deliberately no rating builder.
 */

import React from 'react'
import { SITE_URL } from '@/config/site'

/** Absolute canonical URL from a site-relative path. */
function absoluteUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/** BreadcrumbList — items in order, e.g. Home › Game › Category. */
export function breadcrumbList(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

/**
 * Product with an AggregateOffer across live listings.
 * CALLER GUARANTEES offerCount > 0 — never call this on empty pages.
 */
export function productAggregate({
  name,
  description,
  brand,
  lowPrice,
  highPrice,
  offerCount,
  url,
}: {
  name: string
  description: string
  brand: string
  lowPrice: number
  highPrice: number
  offerCount: number
  /** Optional site-relative path of the page carrying the offers. */
  url?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    brand: { '@type': 'Brand', name: brand },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice,
      highPrice,
      offerCount,
      availability: 'https://schema.org/InStock',
      ...(url ? { url: absoluteUrl(url) } : {}),
    },
  }
}

/** FAQPage — only pass Q&As that are visibly rendered on the page. */
export function faqPage(qas: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qas.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
}

/** Product with a single fixed-price Offer (listing detail pages). */
export function productOffer({
  name,
  price,
  url,
  description,
  brand,
  image,
}: {
  name: string
  price: number
  /** Site-relative path of the listing page. */
  url: string
  description?: string
  brand?: string
  image?: string[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(description ? { description } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    ...(image && image.length > 0 ? { image } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price,
      availability: 'https://schema.org/InStock',
      url: absoluteUrl(url),
    },
  }
}

/**
 * Server-component helper — renders one JSON-LD script tag in the
 * initial HTML. Plain createElement (no JSX) so this stays a .ts file.
 */
export function JsonLd({ data }: { data: object }) {
  return React.createElement('script', {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
  })
}
