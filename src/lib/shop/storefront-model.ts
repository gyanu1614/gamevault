/**
 * Seller storefront model — pure, client-safe. Everything the /shop/[slug]
 * page computes from its rows lives here so it can be tested without a DB:
 * the offers' game/category facets, filter + search + sort, the review
 * breakdown and filter, and the stat-strip figures.
 */

import { parseDeliveryMinutes } from '@/lib/utils/delivery-time'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'

// ─── Offers ─────────────────────────────────────────────────────────────────

export interface StoreOffer {
  /** The shared marketplace card's shape (rendered by ItemCard). */
  offer: ItemOffer
  game: { id: string; slug: string; name: string }
  category: { slug: string; name: string; type: string | null }
  /** ISO timestamp, for Newest. */
  createdAt: string
  /** listings.sales — completed units on this offer. */
  sales: number
}

export type StoreSort = 'newest' | 'price-asc' | 'price-desc' | 'best-selling'

export const ALL = 'all'

export interface StoreFilters {
  game: string // game slug or ALL
  category: string // category slug or ALL
  q: string
  sort: StoreSort
}

export const DEFAULT_STORE_FILTERS: StoreFilters = { game: ALL, category: ALL, q: '', sort: 'newest' }

export interface Facet {
  slug: string
  label: string
  count: number
}

/** Games the seller lists in, most offers first (ties by name). */
export function gameFacets(offers: StoreOffer[]): Facet[] {
  const by = new Map<string, Facet>()
  for (const o of offers) {
    const f = by.get(o.game.slug) ?? { slug: o.game.slug, label: o.game.name, count: 0 }
    f.count++
    by.set(o.game.slug, f)
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/**
 * Categories within the chosen game (or across all games when none is
 * chosen). Merged by category NAME across games so "All Games" shows one
 * "Items" option, not one per game.
 */
export function categoryFacets(offers: StoreOffer[], game: string): Facet[] {
  const by = new Map<string, Facet>()
  for (const o of offers) {
    if (game !== ALL && o.game.slug !== game) continue
    const key = categoryKey(o)
    const f = by.get(key) ?? { slug: key, label: o.category.name, count: 0 }
    f.count++
    by.set(key, f)
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/** Category facet key: the category's display name, slugified. */
export function categoryKey(o: StoreOffer): string {
  return o.category.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'other'
}

/** Best Selling is offered only when at least one offer has recorded sales. */
export function hasSalesData(offers: StoreOffer[]): boolean {
  return offers.some((o) => o.sales > 0)
}

export function storeSortOptions(offers: StoreOffer[]): { slug: StoreSort; label: string }[] {
  const opts: { slug: StoreSort; label: string }[] = [
    { slug: 'newest', label: 'Newest' },
    { slug: 'price-asc', label: 'Price: Low to High' },
    { slug: 'price-desc', label: 'Price: High to Low' },
  ]
  if (hasSalesData(offers)) opts.push({ slug: 'best-selling', label: 'Best Selling' })
  return opts
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

function matchesQuery(o: StoreOffer, q: string): boolean {
  const terms = norm(q).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const hay = norm([o.offer.name, o.game.name, o.category.name, ...o.offer.breadcrumb, ...o.offer.mutations].join(' '))
  return terms.every((t) => hay.includes(t))
}

/** Filter by game, category and search, then sort. Never mutates the input. */
export function filterStoreOffers(offers: StoreOffer[], f: StoreFilters): StoreOffer[] {
  const out = offers.filter(
    (o) =>
      (f.game === ALL || o.game.slug === f.game) &&
      (f.category === ALL || categoryKey(o) === f.category) &&
      matchesQuery(o, f.q),
  )
  const time = (o: StoreOffer) => Date.parse(o.createdAt) || 0
  switch (f.sort) {
    case 'price-asc':
      return out.sort((a, b) => a.offer.pricePerUnit - b.offer.pricePerUnit || time(b) - time(a))
    case 'price-desc':
      return out.sort((a, b) => b.offer.pricePerUnit - a.offer.pricePerUnit || time(b) - time(a))
    case 'best-selling':
      return out.sort((a, b) => b.sales - a.sales || time(b) - time(a))
    case 'newest':
    default:
      return out.sort((a, b) => time(b) - time(a))
  }
}

/** A category choice that no longer exists under the newly picked game resets to All. */
export function reconcileFilters(offers: StoreOffer[], f: StoreFilters): StoreFilters {
  const sortOk = storeSortOptions(offers).some((o) => o.slug === f.sort)
  const gameOk = f.game === ALL || offers.some((o) => o.game.slug === f.game)
  const game = gameOk ? f.game : ALL
  const catOk = f.category === ALL || categoryFacets(offers, game).some((c) => c.slug === f.category)
  return { ...f, game, category: catOk ? f.category : ALL, sort: sortOk ? f.sort : 'newest' }
}

// ─── Stats ──────────────────────────────────────────────────────────────────

/**
 * Average of the delivery times the seller states on their offers, as a short
 * label ("Instant", "~20 Mins", "~3 Hours", "~2 Days"); null with no offers.
 * It is the seller's STATED window, not a measured one — the stat is
 * labelled accordingly on the page.
 */
export function avgStatedDeliveryLabel(deliveryTimes: (string | null | undefined)[]): string | null {
  if (deliveryTimes.length === 0) return null
  const mins = deliveryTimes.reduce<number>((s, d) => s + parseDeliveryMinutes(d ?? null), 0) / deliveryTimes.length
  if (!Number.isFinite(mins)) return null
  if (mins <= 5) return 'Instant'
  if (mins < 60) return `~${Math.round(mins / 5) * 5} Mins`
  if (mins < 60 * 24) {
    const h = Math.round(mins / 60)
    return `~${h} ${h === 1 ? 'Hour' : 'Hours'}`
  }
  const d = Math.round(mins / (60 * 24))
  return `~${d} ${d === 1 ? 'Day' : 'Days'}`
}

/** "Oct 2025" from an ISO timestamp; null when unparsable. */
export function memberSinceLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// ─── Reviews ────────────────────────────────────────────────────────────────

export interface StoreReview {
  id: string
  rating: number
  title: string | null
  comment: string
  /** Buyer handle, already anonymised on the server ("gya***"). */
  buyerLabel: string
  verifiedPurchase: boolean
  createdAt: string
  gameName: string | null
  listingTitle: string | null
  sellerResponse: string | null
}

export interface RatingBreakdown {
  total: number
  /** Mean stars, 1 decimal; 0 when there are no reviews. */
  average: number
  /** Positive share = mean stars / 5, the same scale the offer cards show. */
  positivePercent: number | null
  positive: number
  negative: number
  /** counts[5] … counts[1] */
  counts: Record<1 | 2 | 3 | 4 | 5, number>
}

export function ratingBreakdown(ratings: number[]): RatingBreakdown {
  const counts: RatingBreakdown['counts'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let sum = 0
  let n = 0
  for (const r of ratings) {
    const star = Math.round(Number(r))
    if (!(star >= 1 && star <= 5)) continue
    counts[star as 1 | 2 | 3 | 4 | 5]++
    sum += star
    n++
  }
  const average = n > 0 ? Math.round((sum / n) * 10) / 10 : 0
  return {
    total: n,
    average,
    positivePercent: n > 0 ? Math.round(((sum / n) / 5) * 100) : null,
    positive: counts[4] + counts[5],
    negative: counts[1] + counts[2] + counts[3],
    counts,
  }
}

export type ReviewFilter = 'all' | 'positive' | 'negative' | '5' | '4' | '3' | '2' | '1'

/** Positive = 4–5 stars, Negative = 1–3 (the same split ReviewsList used). */
export function filterReviews(reviews: StoreReview[], f: ReviewFilter): StoreReview[] {
  switch (f) {
    case 'all':
      return reviews
    case 'positive':
      return reviews.filter((r) => r.rating >= 4)
    case 'negative':
      return reviews.filter((r) => r.rating <= 3)
    default: {
      const star = Number(f)
      return reviews.filter((r) => Math.round(r.rating) === star)
    }
  }
}

/** "gya***" — reviewers are never named in full on a public page. */
export function anonymiseBuyer(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  if (!n) return 'Anonymous'
  return `${n.slice(0, Math.min(3, n.length))}***`
}
