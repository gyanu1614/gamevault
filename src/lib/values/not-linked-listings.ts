/**
 * Live item listings of one game with no item page, newest first: what the owner
 * reviews in Admin → Games → Values. One read (the game's id comes from the join),
 * capped: past the cap the job is to add items, not to read a longer list.
 */
export const NOT_LINKED_LIMIT = 50

export interface NotLinkedListing {
  id: string
  title: string
  href: string | null
  seller: string | null
  listedAt: string
}

type AnyClient = { from: (table: string) => any }

export async function loadNotLinkedListings(db: AnyClient, gameSlug: string): Promise<NotLinkedListing[]> {
  const { data, error } = await db
    .from('listings')
    .select('id, title, slug, created_at, game:games!listings_game_id_fkey!inner(slug), category:game_categories!listings_game_category_id_fkey!inner(slug, type), seller:public_profiles!listings_seller_id_fkey(username, shop_name)')
    .eq('game.slug', gameSlug)
    .eq('category.type', 'items')
    .eq('status', 'active')
    .is('value_item_slug', null)
    .order('created_at', { ascending: false })
    .limit(NOT_LINKED_LIMIT)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<Record<string, any>>).map((r) => {
    const category = Array.isArray(r.category) ? r.category[0] : r.category
    const seller = Array.isArray(r.seller) ? r.seller[0] : r.seller
    return {
      id: r.id,
      title: r.title ?? '',
      href: category?.slug && r.slug ? `/${gameSlug}/${category.slug}/${r.slug}` : null,
      seller: seller?.shop_name ?? seller?.username ?? null,
      listedAt: r.created_at,
    }
  })
}
