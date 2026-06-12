import { useQuery } from '@tanstack/react-query'
import { getGameIcon } from '../lib/game-icons'

/**
 * Category tags shown as chips under each Popular Games cover card.
 * Order in the array controls render order; only listed categories are shown.
 */
export type GameCategory = 'accounts' | 'items' | 'boosting' | 'currency' | 'topup'

export interface PopularGame {
  slug: string
  name: string
  /** Small square icon — used as fallback only (cover cards no longer show this) */
  iconSrc: string
  /**
   * Portrait cover art for the Popular Games card.
   * Files live in /public/games/covers/[slug].jpg at 600×800 (3:4 portrait).
   * Drop in real cover art at the same filename to replace placeholders.
   */
  coverSrc: string
  /** Per-game category tags shown as chips below the cover */
  categories: GameCategory[]
}

const cover = (slug: string) => `/games/covers/${slug}.jpg`

const MOCK_POPULAR_GAMES: PopularGame[] = [
  {
    slug: 'valorant',
    name: 'Valorant',
    iconSrc: getGameIcon('valorant'),
    coverSrc: cover('valorant'),
    categories: ['accounts', 'boosting', 'currency'],
  },
  {
    slug: 'roblox',
    name: 'Roblox',
    iconSrc: getGameIcon('roblox'),
    coverSrc: cover('roblox'),
    categories: ['accounts', 'items', 'currency'],
  },
  {
    slug: 'fortnite',
    name: 'Fortnite',
    iconSrc: getGameIcon('fortnite'),
    coverSrc: cover('fortnite'),
    categories: ['accounts', 'items', 'currency'],
  },
  {
    slug: 'league-of-legends',
    name: 'League of Legends',
    iconSrc: getGameIcon('league-of-legends'),
    coverSrc: cover('league-of-legends'),
    categories: ['accounts', 'boosting', 'items', 'currency'],
  },
  {
    slug: 'cs2',
    name: 'CS2',
    iconSrc: getGameIcon('cs2'),
    coverSrc: cover('cs2'),
    categories: ['accounts', 'items'],
  },
  {
    slug: 'genshin-impact',
    name: 'Genshin Impact',
    iconSrc: getGameIcon('genshin-impact'),
    coverSrc: cover('genshin-impact'),
    categories: ['accounts', 'currency'],
  },
  {
    slug: 'call-of-duty',
    name: 'Call of Duty',
    iconSrc: getGameIcon('call-of-duty'),
    coverSrc: cover('call-of-duty'),
    categories: ['accounts', 'boosting', 'currency'],
  },
  {
    slug: 'gta-v',
    name: 'GTA V',
    iconSrc: getGameIcon('gta-v'),
    coverSrc: cover('gta-v'),
    categories: ['accounts', 'currency'],
  },
  {
    slug: 'apex-legends',
    name: 'Apex Legends',
    iconSrc: getGameIcon('apex-legends'),
    coverSrc: cover('apex-legends'),
    categories: ['accounts', 'boosting'],
  },
  {
    slug: 'minecraft',
    name: 'Minecraft',
    iconSrc: getGameIcon('minecraft'),
    coverSrc: cover('minecraft'),
    categories: ['accounts', 'items'],
  },
]

export function usePopularGames() {
  // TODO(supabase): replace mock with real query
  // select slug, name, image_url, cover_url, categories from games where is_popular = true order by order_rank limit 8
  return useQuery({
    queryKey: ['popular-games'],
    queryFn: async (): Promise<PopularGame[]> => MOCK_POPULAR_GAMES,
    staleTime: 5 * 60 * 1000,
  })
}
