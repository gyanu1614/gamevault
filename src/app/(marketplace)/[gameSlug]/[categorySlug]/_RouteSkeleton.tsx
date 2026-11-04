'use client'

/**
 * V19/P23 — Route loading skeleton dispatcher.
 *
 * SEO — this used to be `loading.tsx`. A route-level loading file is a
 * Suspense boundary ABOVE the page, so the HTTP shell flushed with a 200
 * before the page could call `notFound()`: every unmatched game/category
 * URL answered `200 + "Not Found"` (a soft 404 Google was invited to
 * index). It is now a plain component used as the fallback of an in-page
 * Suspense boundary, so the route gate runs first and can still set a real
 * 404 — same skeleton, correct status.
 *
 * It still can't read params (it stayed a client component), so we read the
 * URL on the client and pick the right skeleton by category slug:
 *   • buy-items on a values game               → ItemsSkeleton grid (picture-top item cards)
 *   • other items / accounts / the rest        → ItemsSkeleton (landscape listing cards)
 *   • everything else                          → CurrencySkeleton (hero card + seller rows)
 *
 * The skeleton renders immediately on first paint; the client-side
 * branch is just for picking which one. Both skeletons are sized to
 * match their real pages so the swap is geometrically clean.
 */

import { usePathname } from 'next/navigation'
import CurrencySkeleton from './_CurrencySkeleton'
import BundleCurrencySkeleton from './_BundleCurrencySkeleton'
import ItemsSkeleton from './_ItemsSkeleton'
import { VALUE_CATALOG_GAMES } from '@/lib/value-listings/catalogs'

/**
 * V19/P24/P7.d — Bundle currencies have a different page geometry
 * (platform tiles + region pills + bundle grid + sticky offer card)
 * than flexible currencies (Robux-style hero card + seller rows).
 * loading.tsx can't read the DB, so we keep a hardcoded slug list
 * here. Add to it whenever a new bundle-mode currency goes live.
 */
const BUNDLE_CURRENCY_SLUGS = new Set([
  'buy-vbucks',
  'buy-vp',
  'buy-rp',
  'buy-coins',
  'buy-minecoins',
  'buy-credits',
])

/**
 * V21/P7.o — Currency slugs are the only ones that render the
 * hero-card layout (CurrencySkeleton). Everything else — items,
 * accounts, boosting, top-up, and any future category — renders the
 * items grid, so it gets ItemsSkeleton. Inverting the logic (allowlist
 * the currency slugs, default to items) means new categories never
 * fall through to the wrong skeleton, regardless of their slug.
 */
const FLEX_CURRENCY_SLUGS = new Set([
  'buy-robux',
  'robux',
  'currency',
  'buy-currency',
])

export default function CategoryRouteSkeleton() {
  const pathname = usePathname() ?? ''
  const segments = pathname.split('/').filter(Boolean)
  const categorySlug = segments[segments.length - 1] ?? ''

  // Bundle-style currencies (fixed denominations) → bundle skeleton.
  if (BUNDLE_CURRENCY_SLUGS.has(categorySlug)) return <BundleCurrencySkeleton />
  // Flexible currencies (Robux-style hero card + seller rows).
  if (
    FLEX_CURRENCY_SLUGS.has(categorySlug) ||
    categorySlug.endsWith('-currency')
  ) {
    return <CurrencySkeleton />
  }
  // Everything else (items / accounts / boosting / top-up / future). A values
  // game's Items page shows one picture-top card per item (ItemsGridClient).
  return <ItemsSkeleton grid={categorySlug === 'buy-items' && VALUE_CATALOG_GAMES.includes(segments[0] ?? '')} />
}
