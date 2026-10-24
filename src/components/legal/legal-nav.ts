/**
 * Navigation data for the legal pack: each document's URL, the grouped
 * index (the /legal hub, the page sidebars), and a short "Related Policies"
 * list per doc.
 *
 * Parts (2026-10-23, research: Airbnb and Steam keep buyer terms inside the
 * main Terms, eBay keeps buyer protection, refunds and chargebacks in one
 * policy, CMA37 6.6 warns against terms scattered across many places):
 * five short documents now render as parts of a host page, with their own
 * title, numbering and date unchanged, so every "see the Buyer Terms"
 * cross-reference still points at a real heading. Their old URLs redirect
 * to the part's anchor (next.config.js).
 *
 * `safedrop` is a part of /refunds; /safedrop stays the marketing page.
 * `legalDocHref` is the one place a document's URL is decided.
 */

import { LEGAL_DOCS, type LegalDoc } from '@/lib/legal/documents'

/** host slug → the documents shown as parts of its page, in order. */
export const LEGAL_PARTS: Readonly<Record<string, readonly string[]>> = {
  terms: ['buyer-terms', 'risk'],
  refunds: ['safedrop', 'chargebacks'],
  'trust-safety': ['acceptable-use'],
}

const HOST_OF = new Map(Object.entries(LEGAL_PARTS).flatMap(([host, parts]) => parts.map((p) => [p, host] as const)))

/** The anchor a part's heading carries on its host page. */
export const partAnchor = (slug: string) => `part-${slug}`

/** The page a document is read on: its own, or its host's for a part. */
export function legalPageSlug(slug: string): string {
  return HOST_OF.get(slug) ?? slug
}

export function legalDocHref(slug: string): string {
  const host = HOST_OF.get(slug)
  return host ? `/${host}#${partAnchor(slug)}` : `/${slug}`
}

const BY_SLUG = new Map(LEGAL_DOCS.map((d) => [d.slug, d]))

/** The documents rendered as parts of `slug`'s page (none for most). */
export function legalPageParts(slug: string): LegalDoc[] {
  return (LEGAL_PARTS[slug] ?? []).map((s) => BY_SLUG.get(s)).filter((d): d is LegalDoc => d != null)
}

/**
 * The hub and sidebar grouping, by who the document is for (Etsy's legal hub;
 * the footer uses the same buckets). Pages only: parts appear under their host.
 */
export const LEGAL_GROUPS: ReadonlyArray<{ title: string; slugs: readonly string[] }> = [
  { title: 'Everyone', slugs: ['terms', 'privacy', 'cookies', 'complaints', 'company'] },
  { title: 'Buying', slugs: ['refunds', 'fees'] },
  { title: 'Selling', slugs: ['seller-agreement', 'aml'] },
  { title: 'Rules & Safety', slugs: ['prohibited', 'trust-safety', 'ip'] },
]

/** Curated "Related Policies" for each page (the pages it cross-references most). */
const RELATED: Record<string, readonly string[]> = {
  terms: ['refunds', 'seller-agreement', 'privacy', 'fees'],
  'seller-agreement': ['fees', 'prohibited', 'aml', 'terms'],
  refunds: ['terms', 'complaints', 'fees', 'prohibited'],
  prohibited: ['trust-safety', 'ip', 'terms', 'refunds'],
  privacy: ['cookies', 'aml', 'complaints', 'terms'],
  cookies: ['privacy', 'terms'],
  aml: ['privacy', 'seller-agreement', 'terms'],
  fees: ['seller-agreement', 'refunds', 'terms'],
  complaints: ['refunds', 'privacy', 'terms', 'company'],
  ip: ['prohibited', 'trust-safety', 'terms', 'complaints'],
  'trust-safety': ['prohibited', 'refunds', 'terms', 'ip'],
  company: ['terms', 'privacy', 'complaints'],
}

export function groupedLegalDocs(): Array<{ title: string; docs: LegalDoc[] }> {
  const grouped = LEGAL_GROUPS.map((g) => ({
    title: g.title,
    docs: g.slugs.map((s) => BY_SLUG.get(s)).filter((d): d is LegalDoc => d != null),
  }))
  // A page added to the pack without a group still shows up.
  const placed = new Set(LEGAL_GROUPS.flatMap((g) => g.slugs))
  const rest = LEGAL_DOCS.filter((d) => !placed.has(d.slug) && !HOST_OF.has(d.slug))
  if (rest.length) grouped[grouped.length - 1].docs.push(...rest)
  return grouped
}

export function relatedLegalDocs(slug: string): LegalDoc[] {
  const page = legalPageSlug(slug)
  return (RELATED[page] ?? ['terms', 'privacy'])
    .filter((s) => s !== page)
    .map((s) => BY_SLUG.get(s))
    .filter((d): d is LegalDoc => d != null)
}
