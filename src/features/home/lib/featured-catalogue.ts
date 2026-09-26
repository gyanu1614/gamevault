import { createClient } from '@/lib/supabase/server'

export interface FeaturedCatalogueItem {
  id: string
  name: string
  slug: string
  kind: 'item' | 'currency'
  featuredRank: number
  imagePath: string | null
  gameSlug: string
  gameName: string
  /** Cheapest active listing, or null when nobody is selling one. */
  price: number | null
  /** Currency only. */
  unitSize: number | null
  unitLabel: string | null
  href: string
}

/**
 * Featured catalogue rows for the homepage, with a live price attached.
 *
 * The catalogue is the source of the NAME and the ARTWORK; listings are the
 * source of the PRICE. Keeping them apart is the point: a curated item keeps
 * its clean name and cutout whether or not anyone is selling one, and the
 * price can never go stale because it is resolved per request.
 *
 * `image_clean` gates the homepage. A row whose artwork is missing or still
 * a rough screenshot stays in the table but off the front page, so the
 * catalogue can be filled in gradually without the homepage degrading.
 */
export async function getFeaturedCatalogue(
  kind: 'item' | 'currency',
): Promise<FeaturedCatalogueItem[]> {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('catalogue_items')
    .select(
      `id, name, slug, kind, featured_rank, image_path, image_clean,
       unit_size, unit_label,
       game:games!inner(slug, name, is_active)`,
    )
    .eq('kind', kind)
    .eq('image_clean', true)
    .eq('game.is_active', true)
    .not('featured_rank', 'is', null)
    .order('featured_rank', { ascending: true })

  type Row = {
    id: string
    name: string
    slug: string
    kind: 'item' | 'currency'
    featured_rank: number
    image_path: string | null
    unit_size: number | null
    unit_label: string | null
    game: { slug: string; name: string }
  }

  const items = (rows ?? []) as unknown as Row[]
  if (items.length === 0) return []

  // One pass for prices rather than a query per card. Cheapest active,
  // non-test listing per game+category type.
  const { data: listings } = await supabase
    .from('listings')
    .select(
      `price, game_id,
       game:games!inner(slug),
       category:categories!inner(metadata),
       seller:public_profiles!listings_seller_id_fkey!inner(is_test)`,
    )
    .eq('status', 'active')
    .eq('seller.is_test', false)

  const cheapest = new Map<string, number>()
  for (const row of (listings ?? []) as unknown as {
    price: number
    game: { slug: string }
    category: { metadata: { type?: string } | null }
  }[]) {
    const type = row.category.metadata?.type ?? ''
    const bucket =
      type === 'currency' || type === 'top_up' ? 'currency' : type === 'account' ? 'account' : 'item'
    const key = `${row.game.slug}:${bucket}`
    const price = Number(row.price)
    const prev = cheapest.get(key)
    if (prev === undefined || price < prev) cheapest.set(key, price)
  }

  return items.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind,
    featuredRank: row.featured_rank,
    imagePath: row.image_path,
    gameSlug: row.game.slug,
    gameName: row.game.name,
    price: cheapest.get(`${row.game.slug}:${row.kind}`) ?? null,
    unitSize: row.unit_size,
    unitLabel: row.unit_label,
    href: `/${row.game.slug}`,
  }))
}
