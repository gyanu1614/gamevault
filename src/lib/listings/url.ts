/**
 * Canonical listing URL.
 *
 * ROUTE-006. The canonical listing page is
 * /[gameSlug]/[categorySlug]/[listingSlug]; /listings/[id] is only a legacy
 * resolver that 301s there. Link cards should point at the canonical URL
 * directly so a click costs no redirect hop and crawlers see one URL per
 * listing — falling back to the id form only when a slug is missing, which the
 * resolver then handles.
 */
export function listingUrl(listing: {
  id: string
  slug?: string | null
  game?: { slug?: string | null } | null
  category?: { slug?: string | null } | null
}): string {
  const gameSlug = listing.game?.slug
  const categorySlug = listing.category?.slug
  const listingSlug = listing.slug

  if (gameSlug && categorySlug && listingSlug) {
    return `/${gameSlug}/${categorySlug}/${listingSlug}`
  }

  // No canonical URL available on this row — let the legacy resolver decide
  // between a 301 and a real 404.
  return `/listings/${listing.id}`
}
