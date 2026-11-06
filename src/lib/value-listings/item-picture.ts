/**
 * A listing with no photos of its own takes its item's catalogue picture (owner,
 * 2026-11-06: a Frost Dragon looks the same in every offer, so the seller isn't asked
 * for one). Written on the row, so every card, order and shop page shows it with no
 * new read. It's looked up here, never taken from the browser. Falls back to the game's
 * picture. Runs after the link; never blocks a publish.
 */
type Db = any

async function catalogPicture(db: Db, gameSlug: string, gameId: string, itemSlug: string): Promise<string | null> {
  const query = gameSlug === 'adopt-me'
    ? db.from('adopt_me_pets').select('image_url').eq('slug', itemSlug)
    : db.from('values_items').select('image_url').eq('game_id', gameId).eq('slug', itemSlug)
  const { data } = await query.maybeSingle()
  return data?.image_url ?? null
}

export async function fillMissingListingPicture(db: Db, listingId: string): Promise<void> {
  try {
    const { data: row, error } = await db
      .from('listings')
      .select('images, value_item_slug, game_id, game:games!listings_game_id_fkey(slug, image_url)')
      .eq('id', listingId)
      .maybeSingle()
    if (error) throw error
    if (!row || (Array.isArray(row.images) && row.images.length > 0)) return
    const picture = (row.value_item_slug ? await catalogPicture(db, row.game?.slug ?? '', row.game_id, row.value_item_slug) : null) ?? row.game?.image_url ?? null
    if (!picture) return
    const { error: writeError } = await db.from('listings').update({ images: [picture] }).eq('id', listingId)
    if (writeError) throw writeError
  } catch (e) {
    console.error('[item-picture] could not fill', listingId, e instanceof Error ? e.message : e)
  }
}
