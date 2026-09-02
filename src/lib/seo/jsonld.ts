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
 * The single canonical @id for the DropMarket publisher entity. Every page that
 * names DropMarket as author/publisher references THIS id so Google folds them
 * into one Organization node (E-E-A-T consolidation) instead of many anonymous
 * "DropMarket" strings.
 */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`

/**
 * The Organization node — emitted ONCE on the homepage. Carries the logo and
 * real social profiles (sameAs) so the publisher entity is verifiable. Keep the
 * sameAs list in step with the site footer's social links.
 */
export function organization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'DropMarket',
    url: SITE_URL,
    description:
      'Trusted gaming marketplace with SafeDrop Buyer Protection on every order',
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/brand/logo-mark-lime-256.png`,
    },
    sameAs: [
      'https://twitter.com/dropmarket',
      'https://discord.gg/dropmarket',
      'https://github.com/dropmarket',
    ],
  }
}

/**
 * BlogPosting — a single content-hub article. Uses ONLY real post fields (no
 * synthesised steps/FAQ). `dateModified` is honest (the DB touch-trigger keeps
 * updated_at fresh); it falls back to datePublished for never-edited posts. The
 * publisher references the shared Organization @id for entity consolidation.
 */
export function blogPosting(post: {
  title: string
  description: string
  url: string
  datePublished: string
  dateModified?: string
  authorName: string
  image?: string | null
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url: post.url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': post.url },
    inLanguage: 'en',
    datePublished: post.datePublished,
    dateModified: post.dateModified || post.datePublished,
    author: { '@type': 'Organization', name: post.authorName, url: SITE_URL },
    publisher: { '@id': ORGANIZATION_ID },
    ...(post.image
      ? { image: { '@type': 'ImageObject', url: absoluteUrl(post.image) } }
      : {}),
  }
}

/**
 * ItemList — an ordered set of on-page links (e.g. the value directory, or a
 * blog hub's posts). Describes links that literally exist on the page, so it's
 * always penalty-safe. Items are 1-indexed automatically.
 */
export function itemList(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  }
}

/**
 * Blog — a hub page describing its post collection, so Google can discover the
 * child article URLs directly from the parent's markup (faster indexing of new
 * posts). Lists only posts literally shown on the page.
 */
export function blogCollection({
  name,
  url,
  posts,
}: {
  name: string
  url: string
  posts: {
    title: string
    path: string
    datePublished: string
    description?: string
  }[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name,
    url,
    publisher: { '@id': ORGANIZATION_ID },
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: absoluteUrl(p.path),
      datePublished: p.datePublished,
      ...(p.description ? { description: p.description } : {}),
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
