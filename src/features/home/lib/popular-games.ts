import { createClient } from '@/lib/supabase/server'

export interface GameCategoryChip {
  /** Category's own label — "V-Bucks", "R6 Credits", "Skins & Items". */
  label: string
  /** Full path, e.g. /fortnite/buy-vbucks */
  href: string
}

export interface PopularGameCard {
  slug: string
  name: string
  /** Active, non-test listings. 0 is a real state — the card still renders. */
  listingCount: number
  /** Cheapest active listing, or null when the game has none. */
  fromPrice: number | null
  /** The categories shown as chips, highest-priority first. */
  categories: GameCategoryChip[]
}

/**
 * How many category chips a card shows. Further categories aren't surfaced
 * here; the card links to the game hub, which carries the full list.
 */
const MAX_CHIPS = 3

/**
 * Chips sit under a ~190px card, so a long category name pushes the row to
 * wrap and the card grows taller than its neighbours. Admin-facing names
 * stay descriptive; these are the short forms for that narrow slot.
 *
 * Keyed by category slug, so it survives a rename of the display name.
 */
/**
 * Which categories win the two chip slots. Buyers come for goods first, so
 * accounts and items outrank services. `display_order` is a per-game admin
 * setting and can't express this cross-game preference — without it, a game
 * whose first two rows happen to be Boosting and Coaching (Valorant) would
 * show neither of the things most people are shopping for.
 */
const CHIP_PRIORITY: Record<string, number> = {
  account: 0,
  items: 1,
  currency: 2,
  top_up: 3,
  gift_card: 4,
  service: 5,
}

const SHORT_CHIP_LABEL: Record<string, string> = {
  'buy-vp': 'VP', // "VP (Valorant Points)"
  'buy-items': 'Items', // CS2 calls it "Skins & Items"
  'buy-credits': 'Credits', // "R6 Credits"
  'buy-accounts': 'Accounts',
  'buy-currency': 'Currency',
  'buy-robux': 'Robux',
  'buy-vbucks': 'V-Bucks',
  'buy-skins': 'Skins',
  'top-up': 'Top Up',
  boosting: 'Boosting',
  coaching: 'Coaching',
  'gift-cards': 'Gift Cards',
  limiteds: 'Limiteds',
}

/**
 * Games for the homepage Popular Games grid.
 *
 * The games table is the source of truth: a game with zero listings must
 * still render (as "Opening soon"), so listings are counted per game and
 * joined on rather than filtered by. Sorted by listing count descending, so
 * the sparse tail sits at the end where the 8-card cut makes it visible.
 *
 * Test-seller listings are excluded, matching the SEO indexability rule in
 * the game hub route — a game with only test listings reads as empty here
 * too, rather than advertising inventory nobody can buy.
 */
/**
 * The homepage grid is an allowlist, not everything active.
 *
 * A card is mostly its artwork, so a game without art renders as an empty
 * placeholder frame and drags the whole grid down. Only games with a file at
 * `/public/games/art/<slug>.png` belong here — add the art, then add the
 * slug. Every other game stays fully live at its own URL; it just isn't
 * featured on the homepage.
 *
 * Superseded editions are deliberately absent: fc25 → fc26,
 * grow-a-garden → grow-a-garden-2, gta-v → gta-vi.
 */
const HOMEPAGE_GAMES = [
  'adopt-me',
  'apex-legends',
  'blade-ball',
  'cs2',
  'fc26',
  'fortnite',
  'grow-a-garden-2',
  'gta-vi',
  'r6-siege',
  'roblox',
  'steal-a-brainrot',
  'valorant',
] as const

const HOMEPAGE_GAME_SET: ReadonlySet<string> = new Set(HOMEPAGE_GAMES)

export async function getPopularGames(limit = 8): Promise<PopularGameCard[]> {
  const supabase = await createClient()

  const { data: allGames } = await supabase
    .from('games')
    .select('id, slug, name')
    .eq('is_active', true)

  const games = (allGames as { id: string; slug: string; name: string }[] | null)?.filter(
    (game) => HOMEPAGE_GAME_SET.has(game.slug),
  )

  if (!games?.length) return []

  // One pass over active non-test listings, folded per game in memory. The
  // alternative — a count query per game — is N round-trips for a grid that
  // renders 8 cards.
  const { data: listings } = await supabase
    .from('listings')
    .select('game_id, price, seller:public_profiles!listings_seller_id_fkey!inner(is_test)')
    .eq('status', 'active')
    .eq('seller.is_test', false)

  // Categories for the chips. Ordered by display_order, which is the
  // curation an admin already set — no second ordering rule here.
  //
  // The chip uses the category's OWN name ("V-Bucks", "R6 Credits") rather
  // than a label derived from metadata.type. That is deliberate: several
  // rows are typed `currency` when they are really top-ups (V-Bucks, R6
  // Credits, VP are bought as credit, not traded as an in-game economy the
  // way Robux or Sheckles are). Rendering the real name sidesteps the
  // mistyping and reads more accurately per game.
  const { data: categories } = await supabase
    .from('categories')
    .select('game_id, slug, name, metadata, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  const gameSlugById = new Map(games.map((g) => [g.id, g.slug]))
  const grouped = new Map<string, { label: string; href: string; rank: number }[]>()

  for (const row of (categories ?? []) as {
    game_id: string
    slug: string
    name: string | null
    metadata: { label?: string; type?: string } | null
  }[]) {
    const gameSlug = gameSlugById.get(row.game_id)
    if (!gameSlug) continue
    const list = grouped.get(row.game_id) ?? []
    list.push({
      label: SHORT_CHIP_LABEL[row.slug] || row.name || row.metadata?.label || row.slug,
      href: `/${gameSlug}/${row.slug}`,
      rank: CHIP_PRIORITY[row.metadata?.type ?? ''] ?? 99,
    })
    grouped.set(row.game_id, list)
  }

  const chipsByGame = new Map<string, GameCategoryChip[]>()
  for (const [gameId, list] of grouped) {
    chipsByGame.set(
      gameId,
      list
        .sort((a, b) => a.rank - b.rank)
        .slice(0, MAX_CHIPS)
        .map(({ label, href }) => ({ label, href })),
    )
  }

  const stats = new Map<string, { count: number; min: number }>()
  for (const row of (listings ?? []) as { game_id: string; price: number }[]) {
    const prev = stats.get(row.game_id)
    if (!prev) stats.set(row.game_id, { count: 1, min: row.price })
    else {
      prev.count += 1
      if (row.price < prev.min) prev.min = row.price
    }
  }

  return games
    .map((game) => {
      const stat = stats.get(game.id)
      return {
        slug: game.slug,
        name: game.name,
        listingCount: stat?.count ?? 0,
        fromPrice: stat?.min ?? null,
        categories: chipsByGame.get(game.id) ?? [],
      }
    })
    .sort((a, b) => b.listingCount - a.listingCount)
    .slice(0, limit)
}
