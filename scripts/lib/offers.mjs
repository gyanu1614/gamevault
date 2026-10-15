/**
 * One row per offer. A paged crawl can show the same offer twice (the order
 * shifts while it walks), and values_raw_listings' unique key is (source,
 * source_offer_id, observed_at) with one timestamp per run — one repeat used to
 * kill the whole insert (Steal an Egg, Values Pricing Daily 2026-10-13). Keeps
 * the first sighting.
 */
export function dedupeOffers(listings) {
  const seen = new Set()
  return listings.filter((l) => {
    const k = `${l.source ?? ''}\u0000${l.source_offer_id}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
