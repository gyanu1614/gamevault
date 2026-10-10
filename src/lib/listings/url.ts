import { sellerShopSlug, type SellerIdentityInput } from '@/lib/seller/identity'

/**
 * Canonical listing URL.
 *
 * ROUTE-006. The canonical listing page is
 * /[gameSlug]/[categorySlug]/[listingSlug]; /listings/[id] is only a legacy
 * resolver that 301s there. Link cards should point at the canonical URL
 * directly so a click costs no redirect hop and crawlers see one URL per
 * listing — falling back to the id form only when a slug is missing, which the
 * resolver then handles.
 *
 * Currency listings have NO single-listing page (owner, 2026-10-04): their
 * link is the game's currency page with that seller's offer pinned
 * (`currencyOfferUrl`). The listing route 308s any old currency listing URL
 * there too (`currencyListingRedirect`), so a row that cannot tell its
 * category type still lands in the right place — one hop later.
 */
export function listingUrl(listing: {
  id: string
  slug?: string | null
  game?: { slug?: string | null } | null
  category?: { slug?: string | null; type?: string | null } | null
  /** Optional: lets a currency link name the seller (`?seller=`). */
  seller?: SellerIdentityInput | null
}): string {
  const gameSlug = listing.game?.slug
  const categorySlug = listing.category?.slug
  const listingSlug = listing.slug

  if (gameSlug && categorySlug && isCurrencyCategoryType(listing.category?.type)) {
    return currencyOfferUrl({
      gameSlug,
      categorySlug,
      listingId: listing.id,
      sellerSlug: sellerShopSlug(listing.seller),
    })
  }

  if (gameSlug && categorySlug && listingSlug) {
    return `/${gameSlug}/${categorySlug}/${listingSlug}`
  }

  // No canonical URL available on this row — let the legacy resolver decide
  // between a 301 and a real 404.
  return `/listings/${listing.id}`
}

/**
 * The seller's / an admin's view of a listing that is not live (pending,
 * rejected, paused, sold). The public listing page is ISR and serves active
 * listings only; this route reads through the session (RLS: owner + admins).
 */
export function listingPreviewUrl(listingId: string): string {
  return `/listing-preview/${listingId}`
}

/** Where a listing's owner (or an admin) opens it: the live page, else the preview. */
export function listingOwnerUrl(
  listing: Parameters<typeof listingUrl>[0] & { status?: string | null },
): string {
  if (listing.status === 'active' || isCurrencyCategoryType(listing.category?.type)) {
    return listingUrl(listing)
  }
  return listingPreviewUrl(listing.id)
}

/** URL params the currency pages read (client-side, via SearchParamsBridge). */
export const CURRENCY_SELLER_PARAM = 'seller'
export const CURRENCY_OFFER_PARAM = 'offer'

/** game_categories.type for currency — the one category type with no listing page. */
export function isCurrencyCategoryType(type: string | null | undefined): boolean {
  return type === 'currency'
}

/**
 * A currency offer's public link: `/{game}/{category}?seller=<shop>&offer=<listing id>`.
 * The page pins that offer when it is still live, else that seller's
 * cheapest offer, else renders as normal.
 */
export function currencyOfferUrl(input: {
  gameSlug: string
  categorySlug: string
  listingId?: string | null
  sellerSlug?: string | null
}): string {
  const params = new URLSearchParams()
  if (input.sellerSlug) params.set(CURRENCY_SELLER_PARAM, input.sellerSlug)
  if (input.listingId) params.set(CURRENCY_OFFER_PARAM, input.listingId)
  const qs = params.toString()
  return `/${input.gameSlug}/${input.categorySlug}${qs ? `?${qs}` : ''}`
}

/**
 * The listing route's decision for /{game}/{category}/{listing}: null = render
 * the listing page as before (non-currency, or unknown category → the route's
 * own 404); otherwise the currency page URL to permanently redirect to. A
 * currency listing that is gone still redirects — to the plain currency page.
 */
export function currencyListingRedirect(input: {
  gameSlug: string
  category: { slug: string; type: string | null } | null
  listing: { id: string; seller?: SellerIdentityInput | null } | null
}): string | null {
  const { gameSlug, category, listing } = input
  if (!category || !isCurrencyCategoryType(category.type)) return null
  return currencyOfferUrl({
    gameSlug,
    categorySlug: category.slug,
    listingId: listing?.id ?? null,
    sellerSlug: listing ? sellerShopSlug(listing.seller) : null,
  })
}
