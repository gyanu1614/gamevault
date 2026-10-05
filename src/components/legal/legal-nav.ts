/**
 * Navigation data for the legal pack: each document's URL, the grouped
 * "All Legal Documents" index, and a short "Related Policies" list per doc.
 *
 * Doc slugs mostly equal their route, except `safedrop`, whose policy lives
 * at /safedrop-policy (/safedrop is the marketing page). The old renderer
 * linked `/${slug}` and so sent "SafeDrop Protection Terms" to the marketing
 * page; `legalDocHref` is the one place that mapping lives now.
 */

import { LEGAL_DOCS, type LegalDoc } from '@/lib/legal/documents'

const ROUTE_OVERRIDES: Record<string, string> = {
  safedrop: '/safedrop-policy',
}

export function legalDocHref(slug: string): string {
  return ROUTE_OVERRIDES[slug] ?? `/${slug}`
}

/** Grouping for the sidebar / footer index (same buckets as the site footer). */
export const LEGAL_GROUPS: ReadonlyArray<{ title: string; slugs: readonly string[] }> = [
  { title: 'Core Terms', slugs: ['terms', 'buyer-terms', 'seller-agreement', 'fees'] },
  {
    title: 'Buying & Selling',
    slugs: ['safedrop', 'refunds', 'chargebacks', 'prohibited', 'trust-safety', 'acceptable-use'],
  },
  { title: 'Compliance & Privacy', slugs: ['privacy', 'cookies', 'aml', 'risk', 'complaints', 'ip', 'company'] },
]

/** Curated "Related Policies" for each document (the docs it cross-references most). */
const RELATED: Record<string, readonly string[]> = {
  terms: ['buyer-terms', 'seller-agreement', 'refunds', 'privacy'],
  'buyer-terms': ['safedrop', 'refunds', 'chargebacks', 'terms'],
  'seller-agreement': ['fees', 'prohibited', 'aml', 'terms'],
  safedrop: ['refunds', 'buyer-terms', 'chargebacks', 'risk'],
  refunds: ['safedrop', 'chargebacks', 'complaints', 'buyer-terms'],
  prohibited: ['acceptable-use', 'trust-safety', 'ip', 'terms'],
  'acceptable-use': ['prohibited', 'trust-safety', 'terms', 'ip'],
  privacy: ['cookies', 'aml', 'complaints', 'terms'],
  cookies: ['privacy', 'terms'],
  aml: ['privacy', 'seller-agreement', 'risk', 'terms'],
  risk: ['safedrop', 'refunds', 'chargebacks', 'terms'],
  fees: ['seller-agreement', 'refunds', 'terms', 'chargebacks'],
  chargebacks: ['refunds', 'safedrop', 'fees', 'terms'],
  complaints: ['refunds', 'privacy', 'terms', 'company'],
  ip: ['prohibited', 'acceptable-use', 'terms', 'complaints'],
  'trust-safety': ['prohibited', 'acceptable-use', 'safedrop', 'terms'],
  company: ['terms', 'privacy', 'complaints'],
}

const BY_SLUG = new Map(LEGAL_DOCS.map((d) => [d.slug, d]))

export function relatedLegalDocs(slug: string): LegalDoc[] {
  return (RELATED[slug] ?? ['terms', 'privacy'])
    .filter((s) => s !== slug)
    .map((s) => BY_SLUG.get(s))
    .filter((d): d is LegalDoc => d != null)
}

export function groupedLegalDocs(): Array<{ title: string; docs: LegalDoc[] }> {
  const grouped = LEGAL_GROUPS.map((g) => ({
    title: g.title,
    docs: g.slugs.map((s) => BY_SLUG.get(s)).filter((d): d is LegalDoc => d != null),
  }))
  // A document added to the pack without a group still shows up.
  const placed = new Set(LEGAL_GROUPS.flatMap((g) => g.slugs))
  const rest = LEGAL_DOCS.filter((d) => !placed.has(d.slug))
  if (rest.length) grouped[grouped.length - 1].docs.push(...rest)
  return grouped
}
