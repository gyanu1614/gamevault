/**
 * Seller identity — the single source of truth for how a seller is NAMED
 * and LINKED on every buyer-facing surface.
 *
 * Why this exists: seller display name was re-derived ad hoc at ~20 call
 * sites, and the variants disagreed. The currency category page resolved
 * `username ?? shop_name` (inverted vs everywhere else), so a seller
 * trading as "BloxMarket" was shown to buyers as "coolguy90". Several
 * shop links also pointed at `/shop/{username}` while the canonical
 * storefront URL is `/shop/{shop_slug}`, giving every shop two live URLs.
 *
 * Rules encoded here, so no call site has to remember them:
 *   • Display name  → shop_name, else username, else "Seller".
 *   • Shop URL      → shop_slug, else username (the /shop route keeps a
 *                     username fallback for old links; see shop/[slug]).
 *   • Blank-safe    → `||` + trim, never `??`. A seller row can hold an
 *                     empty string (profiles.business_name already does),
 *                     and `??` would happily render a blank name/href.
 *
 * Accepts snake_case (raw Supabase rows) and camelCase (shaped view
 * models) on the same input so call sites don't need to normalize first.
 */

export interface SellerIdentityInput {
  username?: string | null
  /** Raw DB row shape. */
  shop_name?: string | null
  shop_slug?: string | null
  /** Shaped view-model shape. */
  shopName?: string | null
  shopSlug?: string | null
}

/** Trimmed value, or null when absent/blank. Blank strings are not names. */
function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function shopName(seller: SellerIdentityInput | null | undefined): string | null {
  return clean(seller?.shop_name) ?? clean(seller?.shopName)
}

function username(seller: SellerIdentityInput | null | undefined): string | null {
  return clean(seller?.username)
}

/**
 * What buyers see. A seller trading under a shop name is shown that name;
 * everyone else falls back to their handle.
 */
export function sellerDisplayName(
  seller: SellerIdentityInput | null | undefined,
  fallback = 'Seller',
): string {
  return shopName(seller) ?? username(seller) ?? fallback
}

/**
 * The canonical storefront slug. Prefers shop_slug — it is the
 * de-duplicated value generated server-side by the `generate_shop_slug`
 * RPC, so it is unique where a shop *name* is not.
 */
export function sellerShopSlug(
  seller: SellerIdentityInput | null | undefined,
): string | null {
  return clean(seller?.shop_slug) ?? clean(seller?.shopSlug) ?? username(seller)
}

/**
 * Canonical storefront href, or null when the seller has no addressable
 * shop. Call sites must handle null rather than emitting "/shop/undefined".
 */
export function sellerShopHref(
  seller: SellerIdentityInput | null | undefined,
): string | null {
  const slug = sellerShopSlug(seller)
  return slug ? `/shop/${slug}` : null
}

/** Uppercase initial for avatar fallback tiles. */
export function sellerInitial(
  seller: SellerIdentityInput | null | undefined,
): string {
  return sellerDisplayName(seller).charAt(0).toUpperCase()
}

// ── Reputation ───────────────────────────────────────────────────

export interface SellerRatingInput {
  /** 0–5 star average, mirroring `reviews.rating`. NOT a percentage. */
  seller_rating?: number | null
  sellerRating?: number | null
  total_reviews?: number | null
  totalReviews?: number | null
  reviewCount?: number | null
}

/**
 * Positive-feedback percentage (0–100), or null when there is nothing
 * honest to show.
 *
 * Two bugs this exists to kill:
 *
 *  1. SCALE. `profiles.seller_rating` is a 0–5 star average. Surfaces that
 *     printed it straight into a "%" turned a perfect 5/5 seller into "5%".
 *     Others divided by 20, assuming 0–100. Checkout had the only correct
 *     conversion; this is now the single source of it.
 *
 *  2. FABRICATION. Several surfaces defaulted a missing rating to 95 and
 *     tested truthiness, so a brand-new seller with no sales advertised
 *     "95%" — and a genuine 0 also rendered as 95. A seller with no reviews
 *     has no rating: return null and let the caller show "New Seller"
 *     rather than invent a number.
 */
export function sellerRatingPercent(
  seller: SellerRatingInput | null | undefined,
): number | null {
  const reviews = Number(
    seller?.total_reviews ?? seller?.totalReviews ?? seller?.reviewCount ?? 0,
  )
  if (!Number.isFinite(reviews) || reviews <= 0) return null

  const stars = Number(seller?.seller_rating ?? seller?.sellerRating ?? 0)
  if (!Number.isFinite(stars) || stars <= 0) return null

  return Math.min(100, Math.max(0, (stars / 5) * 100))
}
