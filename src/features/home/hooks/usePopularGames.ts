import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getGameIcon } from '../lib/game-icons'

/**
 * Category tags shown as chips under each Popular Games cover card.
 * Order in the array controls render order; only listed categories are shown.
 */
export type GameCategory = 'accounts' | 'items' | 'boosting' | 'currency' | 'topup'

export interface PopularGame {
  slug: string
  name: string
  /** Small square icon — used as a fallback only (cover cards no longer show this). */
  iconSrc: string
  /**
   * Portrait cover art for the Popular Games card.
   * V17q — Now sourced from games.cover_url (admin wizard upload).
   * If the admin hasn't uploaded a cover yet, falls back to a static
   * placeholder under /games/covers/{slug}.jpg so nothing breaks
   * visually during onboarding.
   */
  coverSrc: string
  /** Per-game category tags shown as chips below the cover. */
  categories: GameCategory[]
  /**
   * Mobile homepage — full list of the game's active categories
   * (display_order asc) so the compact card can render tappable
   * category pills linking to /{game}/{categorySlug}.
   */
  categoryLinks: { slug: string; label: string }[]
  /**
   * V17u — Canonical landing URL for the card. Resolved from the
   * game's first active category (lowest display_order). Falls back
   * to /{slug}/buy-currency if nothing's enabled so the click never
   * 404s. The static /game/{slug} route doesn't exist — this is the
   * real marketplace path.
   */
  href: string
}

const fallbackCover = (slug: string) => `/games/covers/${slug}.jpg`

// V17q — Map DB metadata.type → the chip vocab the UI uses. Keeps the
// PopularGame surface area small while letting the source of truth
// (categories.metadata.type) stay canonical.
const TYPE_TO_CHIP: Record<string, GameCategory> = {
  currency: 'currency',
  items: 'items',
  account: 'accounts',
  service: 'boosting',
  top_up: 'topup',
}

interface GameRow {
  slug: string
  name: string
  image_url: string | null
  cover_url: string | null
  is_active: boolean
  is_popular: boolean | null
  sort_order: number | null
}

interface CategoryRow {
  game_id: string
  metadata: { type?: string } | null
  is_active: boolean
}

export function usePopularGames() {
  return useQuery({
    queryKey: ['popular-games'],
    queryFn: async (): Promise<PopularGame[]> => {
      const supabase = createClient()

      // Pull active games sorted by sort_order. Use a "popular flag if
      // available, fall back to sort_order top-N" heuristic so the
      // shelf is populated even on instances that haven't curated
      // is_popular yet.
      // V17s — Two-step fetch with graceful fallback. First attempt
      // includes is_popular. If the column doesn't exist on this DB
      // (Phase A migration not run), retry without it so the shelf
      // still populates from sort_order alone.
      let rawGames: (GameRow & { id: string })[] | null = null
      const withPopular = (await supabase
        .from('games')
        .select('id, slug, name, image_url, cover_url, is_active, is_popular, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })) as { data: any; error: any }
      if (withPopular.error) {
        console.warn('[popular-games] is_popular column missing, falling back:', withPopular.error.message)
        const withoutPopular = (await supabase
          .from('games')
          .select('id, slug, name, image_url, cover_url, is_active, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })) as { data: any; error: any }
        if (withoutPopular.error) {
          console.error('[popular-games] games fetch failed:', withoutPopular.error.message)
          return []
        }
        rawGames = (withoutPopular.data ?? []).map((g: any) => ({ ...g, is_popular: false }))
      } else {
        rawGames = withPopular.data
      }

      if (!rawGames || rawGames.length === 0) return []

      // V17s — Curation-respecting selection.
      //   • If any games are starred: show ONLY those. Admin chose.
      //   • If none are starred (fresh install): fall back to the top
      //     10 by sort_order so the shelf isn't empty out of the box.
      const starred = rawGames.filter((g) => g.is_popular)
      const popularFirst = (starred.length > 0 ? starred : rawGames).slice(0, 10)

      // V17u — Fetch each popular game's first active category so the
      // card click lands on the real marketplace page (/{game}/{cat}).
      // One round-trip for all selected games — ordered by
      // display_order so we can pick the first per game in JS.
      const gameIds = popularFirst.map((g) => g.id)
      const { data: cats } = (await supabase
        .from('categories')
        .select('game_id, slug, name, metadata, display_order')
        .in('game_id', gameIds)
        .eq('is_active', true)
        .order('display_order', { ascending: true })) as unknown as {
          data: {
            game_id: string
            slug: string
            name: string | null
            metadata: { label?: string; name?: string } | null
            display_order: number | null
          }[] | null
        }

      const firstCategoryByGame = new Map<string, string>()
      // Mobile pills — every active category per game, ordered by
      // display_order (query order preserved). Label resolution mirrors
      // GlobalSearch: name → metadata label → Title-Cased slug.
      const categoriesByGame = new Map<string, { slug: string; label: string }[]>()
      for (const c of cats ?? []) {
        if (!firstCategoryByGame.has(c.game_id)) {
          firstCategoryByGame.set(c.game_id, c.slug)
        }
        const label =
          c.name ||
          c.metadata?.label ||
          c.metadata?.name ||
          c.slug
            .replace(/^buy-/, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (ch) => ch.toUpperCase())
        const list = categoriesByGame.get(c.game_id)
        if (list) list.push({ slug: c.slug, label })
        else categoriesByGame.set(c.game_id, [{ slug: c.slug, label }])
      }

      return popularFirst.map((g): PopularGame => {
        const firstCategory = firstCategoryByGame.get(g.id)
        // Fallback: if a game somehow has no categories, send the
        // user to /{slug}/buy-currency. Doesn't 404 (the category
        // page renders a "no listings" empty state).
        const href = firstCategory ? `/${g.slug}/${firstCategory}` : `/${g.slug}/buy-currency`
        return {
          slug: g.slug,
          name: g.name,
          categories: [],
          categoryLinks: categoriesByGame.get(g.id) ?? [],
          iconSrc: g.image_url ?? getGameIcon(g.slug),
          coverSrc: g.cover_url ?? fallbackCover(g.slug),
          href,
        }
      })
    },
    staleTime: 5 * 60 * 1000,
    // V17t — Keep the previous result on screen while a refetch is in
    // flight. Means the shelf doesn't blank out when the cache goes
    // stale or the query gets invalidated (e.g. star-toggle from
    // admin/games → revalidatePath('/')) — the user sees the old
    // cards until the new ones swap in.
    placeholderData: (prev) => prev,
  })
}
