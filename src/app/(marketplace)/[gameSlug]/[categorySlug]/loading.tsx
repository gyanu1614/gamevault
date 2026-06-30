'use client'

/**
 * V19/P23 — Route loading skeleton dispatcher.
 *
 * Next's `loading.tsx` is a Suspense fallback and can't read params.
 * So we read the URL on the client and pick the right skeleton by
 * category slug:
 *   • items / buy-items / metadata.type=items → ItemsSkeleton (filter band + landscape card grid)
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

export default function CategoryLoading() {
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
  // Everything else (items / accounts / boosting / top-up / future).
  return <ItemsSkeleton />
}
