import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getGameIcon } from '../lib/game-icons'

/**
 * Spotlight games — the admin-curated set featured in the mobile
 * hamburger menu's "Popular Games" card grid. Driven by
 * games.is_spotlight (toggled from /admin/games). No sort_order
 * fallback: if nothing is spotlit the grid simply hides, so the section
 * is always an intentional curation.
 */
export interface SpotlightCategory {
  slug: string
  label: string
  /** categories.metadata.type — used to prefer currency/items for the card tap. */
  type: string | null
}

export interface SpotlightGame {
  slug: string
  name: string
  /** Small square logo (games.image_url) with a registered-icon fallback. */
  iconSrc: string
  /**
   * Card-tap destination — prefers the game's Currency section, then
   * Items, then the first active category. Never 404s.
   */
  href: string
  /** Active categories for this game, rendered as tappable pills. */
  categoryLinks: SpotlightCategory[]
}

interface GameRow {
  id: string
  slug: string
  name: string
  image_url: string | null
  is_active: boolean
  is_spotlight: boolean | null
  sort_order: number | null
}

const catLabel = (slug: string, name: string | null, metadata: { label?: string; name?: string } | null) =>
  name ||
  metadata?.label ||
  metadata?.name ||
  slug
    .replace(/^buy-/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

export function useSpotlightGames() {
  return useQuery({
    queryKey: ['spotlight-games'],
    queryFn: async (): Promise<SpotlightGame[]> => {
      const supabase = createClient()

      // Fetch active, spotlit games ordered by sort_order. Guard the
      // is_spotlight column the same way usePopularGames guards
      // is_popular: if the migration hasn't run on this DB the query
      // errors, and we return [] so the grid just hides.
      const { data, error } = (await supabase
        .from('games')
        .select('id, slug, name, image_url, is_active, is_spotlight, sort_order')
        .eq('is_active', true)
        .eq('is_spotlight', true)
        .order('sort_order', { ascending: true })
        .limit(4)) as { data: any; error: any }

      if (error) {
        console.warn('[spotlight-games] fetch failed (is_spotlight column missing?):', error.message)
        return []
      }

      const rows = (data ?? []) as GameRow[]
      if (rows.length === 0) return []

      // Every active category per spotlit game (display_order asc) so the
      // card can render tappable pills and pick a smart landing target.
      const gameIds = rows.map((g) => g.id)
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
            metadata: { label?: string; name?: string; type?: string } | null
            display_order: number | null
          }[] | null
        }

      const categoriesByGame = new Map<string, SpotlightCategory[]>()
      for (const c of cats ?? []) {
        const entry: SpotlightCategory = {
          slug: c.slug,
          label: catLabel(c.slug, c.name, c.metadata),
          type: c.metadata?.type ?? null,
        }
        const list = categoriesByGame.get(c.game_id)
        if (list) list.push(entry)
        else categoriesByGame.set(c.game_id, [entry])
      }

      return rows.map((g): SpotlightGame => {
        const links = categoriesByGame.get(g.id) ?? []
        // Card tap → Currency, else Items, else first active category.
        const currency = links.find((c) => c.type === 'currency')
        const items = links.find((c) => c.type === 'items')
        const target = currency ?? items ?? links[0]
        return {
          slug: g.slug,
          name: g.name,
          iconSrc: g.image_url ?? getGameIcon(g.slug),
          href: target ? `/${g.slug}/${target.slug}` : `/${g.slug}/buy-currency`,
          categoryLinks: links,
        }
      })
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}
