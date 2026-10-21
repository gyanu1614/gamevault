/**
 * Shared writes on values_raw_listings (Steal An Egg + eldorado-structured
 * games such as Murder Mystery 2).
 */

/**
 * After a crawl is saved: listings not seen in it stop counting.
 *
 * Only rows still active are touched. Without the is_active filter every
 * daily run rewrote the game's whole history (2026-10-20 usage audit, B3).
 */
export async function retireUnseenRawListings(db, gameId, observedAt) {
  const { error } = await db
    .from("values_raw_listings")
    .update({ is_active: false })
    .eq("game_id", gameId)
    .eq("is_active", true)
    .lt("observed_at", observedAt);
  if (error) throw new Error(`values_raw_listings retire: ${error.message}`);
}
