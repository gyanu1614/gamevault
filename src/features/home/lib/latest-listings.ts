import { createClient } from '@/lib/supabase/server'

export interface LatestListing {
  id: string
  title: string
  price: number
  /** First listing image, or null — the card falls back to the game mark. */
  image: string | null
  gameSlug: string
  gameName: string
  /** categories.metadata.type — item / account / currency / top_up / service. */
  categoryType: string | null
  categoryLabel: string
  href: string
  listedAt: string
  /** Which layout this listing gets — see cardTypeFor. */
  cardType: ListingCardType
  /** Currency cards: how much you get. Null when the seller didn't set one. */
  quantity: number | null
  /** Account cards: delivery promise, the one fact every account listing has. */
  deliveryTime: string | null
}

/**
 * Which card treatment a listing gets.
 *
 * Currency and accounts have nothing to photograph — a currency card that
 * tries to show art ends up being the game's logo, and an account is a set
 * of facts, not an object. Each gets a layout built around what it actually
 * has: the amount, or the stats.
 */
export type ListingCardType = 'item' | 'currency' | 'account'

function cardTypeFor(categoryType: string | null): ListingCardType {
  if (categoryType === 'account') return 'account'
  if (categoryType === 'currency' || categoryType === 'top_up') return 'currency'
  return 'item'
}

/**
 * Active listings for the homepage rail, mixed across games.
 *
 * One card per listing. There is no catalogue-item table in this schema, so
 * a listing IS the unit — grouping by title would mean matching seller-written
 * free text, which is unreliable and would invent a "From $X" that isn't real.
 *
 * Ordering is round-robin by game, cheapest first within each game. Straight
 * `created_at DESC` produced a rail that was almost entirely Adopt Me, which
 * has 22 of the 48 active listings — round-robin means every game with stock
 * is visible before any game repeats. Cheapest-first is a real stand-in for
 * "most popular": there is no sales or view metric worth trusting on a young
 * marketplace, and lowest price is what most buyers actually pick.
 *
 * Test-seller listings are excluded, matching the rule used elsewhere: a
 * listing nobody can actually buy shouldn't appear on the homepage.
 */
export async function getLatestListings(limit = 24): Promise<LatestListing[]> {
  const supabase = await createClient()

  // Fetch wider than `limit` so the round-robin has every game to draw from;
  // the interleave below is what trims to `limit`.
  const { data } = await supabase
    .from('listings')
    .select(
      `id, title, price, images, slug, created_at, quantity, delivery_time,
       game:games!inner(slug, name, is_active),
       category:categories!inner(slug, name, metadata),
       seller:public_profiles!listings_seller_id_fkey!inner(is_test)`,
    )
    .eq('status', 'active')
    .eq('seller.is_test', false)
    .eq('game.is_active', true)
    .order('price', { ascending: true })
    .limit(200)

  type Row = {
    id: string
    title: string
    price: number
    images: string[] | null
    slug: string | null
    created_at: string
    quantity: number | null
    delivery_time: string | null
    game: { slug: string; name: string }
    category: { slug: string; name: string | null; metadata: { type?: string; label?: string } | null }
  }

  const mapped = ((data ?? []) as unknown as Row[])
    .filter((row) => {
      // Item cards are art-led, so an item listing with no real art (or with
      // the game's own logo standing in) has nothing to show and is dropped.
      // Currency and account cards carry no art by design, so they stay.
      if (cardTypeFor(row.category.metadata?.type ?? null) !== 'item') return true
      const image = row.images?.[0]
      return Boolean(image) && !image!.startsWith('/games/')
    })
    .map((row) => ({
    id: row.id,
    title: row.title,
    price: Number(row.price),
    image: row.images?.[0] ?? null,
    gameSlug: row.game.slug,
    gameName: row.game.name,
    categoryType: row.category.metadata?.type ?? null,
    categoryLabel: row.category.name || row.category.metadata?.label || row.category.slug,
    // Listing detail route: /{game}/{category}/{listing}
    href: `/${row.game.slug}/${row.category.slug}/${row.slug ?? row.id}`,
    listedAt: row.created_at,
    cardType: cardTypeFor(row.category.metadata?.type ?? null),
    quantity: row.quantity ?? null,
    deliveryTime: row.delivery_time ?? null,
  }))

  // Bucket by game (each bucket already cheapest-first from the query), then
  // deal one card per game per pass.
  const buckets = new Map<string, LatestListing[]>()
  for (const listing of mapped) {
    const bucket = buckets.get(listing.gameSlug) ?? []
    bucket.push(listing)
    buckets.set(listing.gameSlug, bucket)
  }

  const queues = [...buckets.values()]
  const mixed: LatestListing[] = []
  let round = 0
  while (mixed.length < limit) {
    const dealt = queues.filter((q) => q.length > round)
    if (dealt.length === 0) break
    for (const queue of dealt) {
      if (mixed.length >= limit) break
      mixed.push(queue[round])
    }
    round += 1
  }

  return mixed
}
