import { useQuery } from '@tanstack/react-query'
import { getGameIcon } from '../lib/game-icons'

export interface PopularCurrency {
  slug: string
  name: string
  game: string
  iconSrc: string
  fromPrice: number
  badges?: ('instant' | string)[]
}

const MOCK_POPULAR_CURRENCIES: PopularCurrency[] = [
  { slug: 'valorant-points',  name: 'Valorant Points',  game: 'Valorant',  iconSrc: getGameIcon('valorant'),          fromPrice:  8.40, badges: ['instant', 'Region-safe'] },
  { slug: 'robux',            name: 'Robux',            game: 'Roblox',    iconSrc: getGameIcon('roblox'),            fromPrice: 78.00, badges: ['instant'] },
  { slug: 'v-bucks',          name: 'V-Bucks',          game: 'Fortnite',  iconSrc: getGameIcon('fortnite'),          fromPrice: 64.50, badges: ['instant'] },
  { slug: 'riot-points',      name: 'Riot Points',      game: 'League',    iconSrc: getGameIcon('league-of-legends'), fromPrice: 31.00, badges: [] },
  { slug: 'genesis-crystals', name: 'Genesis Crystals', game: 'Genshin',   iconSrc: getGameIcon('genshin-impact'),    fromPrice: 89.00, badges: ['instant'] },
  { slug: 'cod-points',       name: 'CoD Points',       game: 'Warzone',   iconSrc: getGameIcon('call-of-duty'),      fromPrice: 19.00, badges: ['instant'] },
  { slug: 'gta-shark-cards',  name: 'Shark Cards',      game: 'GTA V',     iconSrc: getGameIcon('gta-v'),             fromPrice: 14.50, badges: [] },
  { slug: 'apex-coins',       name: 'Apex Coins',       game: 'Apex',      iconSrc: getGameIcon('apex-legends'),      fromPrice: 10.20, badges: ['instant'] },
  { slug: 'minecoins',        name: 'Minecoins',        game: 'Minecraft', iconSrc: getGameIcon('minecraft'),         fromPrice:  6.75, badges: [] },
  { slug: 'pubg-uc',          name: 'PUBG UC',          game: 'PUBG',      iconSrc: getGameIcon('pubg'),              fromPrice: 12.00, badges: ['instant'] },
  { slug: 'free-fire-diamonds', name: 'FF Diamonds',    game: 'Free Fire', iconSrc: getGameIcon('free-fire'),         fromPrice:  4.50, badges: ['instant'] },
  { slug: 'fc25-coins',       name: 'FC 25 Coins',      game: 'FC 25',     iconSrc: getGameIcon('fc25'),              fromPrice: 22.00, badges: [] },
  { slug: 'r6-credits',       name: 'R6 Credits',       game: 'Siege',     iconSrc: getGameIcon('rainbow-six-siege'), fromPrice: 16.30, badges: ['instant'] },
  { slug: 'tarkov-roubles',   name: 'Tarkov Roubles',   game: 'Tarkov',    iconSrc: getGameIcon('escape-from-tarkov'),fromPrice: 18.00, badges: [] },
  { slug: 'cs2-keys',         name: 'CS2 Keys',         game: 'CS2',       iconSrc: getGameIcon('cs2'),               fromPrice:  2.50, badges: ['instant'] },
  { slug: 'valorant-pts-2',   name: 'VP Bundles',       game: 'Valorant',  iconSrc: getGameIcon('valorant'),          fromPrice: 45.00, badges: [] },
  { slug: 'robux-bulk',       name: 'Robux Bulk',       game: 'Roblox',    iconSrc: getGameIcon('roblox'),            fromPrice: 28.00, badges: ['instant'] },
  { slug: 'v-bucks-bundle',   name: 'V-Bucks Bundle',   game: 'Fortnite',  iconSrc: getGameIcon('fortnite'),          fromPrice: 24.00, badges: ['instant'] },
  { slug: 'rp-bundle',        name: 'RP Bundle',        game: 'League',    iconSrc: getGameIcon('league-of-legends'), fromPrice: 12.00, badges: [] },
  { slug: 'genesis-bundle',   name: 'Genesis Bundle',   game: 'Genshin',   iconSrc: getGameIcon('genshin-impact'),    fromPrice: 38.00, badges: ['instant'] },
]

export function usePopularCurrencies() {
  // TODO(supabase): replace mock with real query
  // select slug, name, game, image_url as icon_src, min_price as from_price, badges from currencies where is_popular = true
  return useQuery({
    queryKey: ['popular-currencies'],
    queryFn: async (): Promise<PopularCurrency[]> => MOCK_POPULAR_CURRENCIES,
    staleTime: 5 * 60 * 1000,
  })
}
