// Cookie-free: the homepage is static (ISR). The cookie client calls
// cookies(), which would force it to render per request. Listing reads are
// cached under HOME_LISTINGS_TAG (lib/listings/read-client), which every
// listing mutation revalidates — an untagged read would never refresh here.
import { createHomeListingsReadClient } from '@/lib/listings/read-client'
import { listingUrl } from '@/lib/listings/url'
import { quantityUnit, type QuantityGranularity } from '@/lib/currency/quantity-unit'

export interface LatestListing {
  id: string
  title: string
  price: number
  /** First listing image, or null — the card falls back to the game mark. */
  image: string | null
  gameSlug: string
  gameName: string
  /** game_categories.type — items / account / currency / top_up / service / gift_card. */
  categoryType: string
  categoryLabel: string
  href: string
  listedAt: string
  /** Which layout this listing gets — see cardTypeFor. */
  cardType: ListingCardType
  /** Currency cards: how much you get. Null when the seller didn't set one. */
  quantity: number | null
  /** Account cards: delivery promise, the one fact every account listing has. */
  deliveryTime: string | null
  /**
   * The card's picture: the currency's own icon for currency listings, the
   * item image for items, else the game's cover art. Null when none exists.
   */
  art: string | null
  /**
   * Per-unit currency: what the price covers ("Robux", "K", "M"), shown as
   * "$0.0052/Robux" like the game hub. Null for everything else.
   */
  priceSuffix: string | null
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

function cardTypeFor(categoryType: string): ListingCardType {
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
  const supabase = createHomeListingsReadClient()

  // Fetch wider than `limit` so the round-robin has every game to draw from;
  // the interleave below is what trims to `limit`.
  const { data } = await supabase
    .from('listings')
    .select(
      `id, title, price, images, slug, created_at, quantity, delivery_time,
       game:games!inner(id, slug, name, is_active, image_url),
       category:game_categories!listings_game_category_id_fkey!inner(slug, name, type),
       seller:public_profiles!listings_seller_id_fkey!inner(is_test, username, shop_slug)`,
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
    game: { id: string; slug: string; name: string; image_url: string | null }
    category: { slug: string; name: string; type: string }
    seller: { username: string | null; shop_slug: string | null } | null
  }

  const rows = (data ?? []) as unknown as Row[]

  // Currency icon and unit (the logo beside each currency page title, and
  // what one price covers) for the games that have a currency listing here.
  // One small read of three JSON fields.
  const currencyGameIds = Array.from(
    new Set(rows.filter((r) => r.category.type === 'currency').map((r) => r.game.id)),
  )
  const currencyIcon = new Map<string, string>()
  const currencyUnit = new Map<string, string>()
  if (currencyGameIds.length > 0) {
    const { data: cfgs } = await supabase
      .from('category_configs')
      .select(
        'game_id, icon:config->>currency_icon_url, unit:config->>unit_label, granularity:config->>quantity_granularity',
      )
      .eq('category_type', 'currency')
      .in('game_id', currencyGameIds)
    for (const c of (cfgs ?? []) as Array<{
      game_id: string
      icon: string | null
      unit?: string | null
      granularity?: QuantityGranularity | null
    }>) {
      if (c.icon) currencyIcon.set(c.game_id, c.icon)
      if (c.unit || c.granularity === 'thousand' || c.granularity === 'million') {
        currencyUnit.set(c.game_id, quantityUnit(c.granularity, c.unit))
      }
    }
  }

  const mapped = rows
    .filter((row) => {
      // Item cards are art-led, so an item listing with no real art (or with
      // the game's own logo standing in) has nothing to show and is dropped.
      // Currency and account cards carry no art by design, so they stay.
      if (cardTypeFor(row.category.type) !== 'item') return true
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
    categoryType: row.category.type,
    categoryLabel: row.category.name || row.category.slug,
    // Listing detail route /{game}/{category}/{listing} — or, for currency
    // (no listing page), the currency page with this seller's offer pinned.
    href: listingUrl({ ...row, slug: row.slug ?? row.id }),
    listedAt: row.created_at,
    cardType: cardTypeFor(row.category.type),
    quantity: row.quantity ?? null,
    deliveryTime: row.delivery_time ?? null,
    art:
      (row.category.type === 'currency' ? currencyIcon.get(row.game.id) : undefined) ??
      (cardTypeFor(row.category.type) === 'item' ? row.images?.[0] : undefined) ??
      row.game.image_url ??
      null,
    priceSuffix: row.category.type === 'currency' ? (currencyUnit.get(row.game.id) ?? null) : null,
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
