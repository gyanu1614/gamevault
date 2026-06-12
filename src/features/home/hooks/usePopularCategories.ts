import { useQuery } from '@tanstack/react-query'
import { getGameIcon } from '../lib/game-icons'
import type { PopularCurrency } from './usePopularCurrencies'

/**
 * Extended category card — used for Items and Accounts tabs.
 * Mirrors Currencies' visual shape so all 3 tabs render identically-sized cards.
 */
export interface CategoryCard {
  href: string
  slug: string
  name: string
  /** Game label rendered as subtitle, e.g. "Fortnite" */
  game: string
  iconSrc: string
  /** Lowest-priced listing in the category */
  fromPrice: number
  /** Active listing count, formatted as "1.2K" by the card */
  listingCount: number
}

const MOCK_ITEMS: CategoryCard[] = [
  { href: '/game/cs2/items',               slug: 'cs2-items',          name: 'CS2 Skins',         game: 'CS2',       iconSrc: getGameIcon('cs2'),               fromPrice:   1.20, listingCount: 12400 },
  { href: '/game/fortnite/items',          slug: 'fortnite-items',     name: 'Fortnite Skins',    game: 'Fortnite',  iconSrc: getGameIcon('fortnite'),          fromPrice:   4.50, listingCount:  8200 },
  { href: '/game/roblox/items',            slug: 'roblox-items',       name: 'Roblox Items',      game: 'Roblox',    iconSrc: getGameIcon('roblox'),            fromPrice:   2.00, listingCount: 15300 },
  { href: '/game/genshin-impact/items',    slug: 'genshin-items',      name: 'Genshin Items',     game: 'Genshin',   iconSrc: getGameIcon('genshin-impact'),    fromPrice:   3.20, listingCount:  4100 },
  { href: '/game/league-of-legends/items', slug: 'league-items',       name: 'League Skins',      game: 'League',    iconSrc: getGameIcon('league-of-legends'), fromPrice:   2.80, listingCount:  6700 },
  { href: '/game/call-of-duty/items',      slug: 'cod-items',          name: 'CoD Bundles',       game: 'Warzone',   iconSrc: getGameIcon('call-of-duty'),      fromPrice:   5.40, listingCount:  3500 },
  { href: '/game/valorant/items',          slug: 'valorant-items',     name: 'Valorant Skins',    game: 'Valorant',  iconSrc: getGameIcon('valorant'),          fromPrice:   3.90, listingCount:  9800 },
  { href: '/game/gta-v/items',             slug: 'gta-items',          name: 'GTA Modded Items',  game: 'GTA V',     iconSrc: getGameIcon('gta-v'),             fromPrice:   8.00, listingCount:  2200 },
  { href: '/game/apex-legends/items',      slug: 'apex-items',         name: 'Apex Heirlooms',    game: 'Apex',      iconSrc: getGameIcon('apex-legends'),      fromPrice:   6.50, listingCount:  1800 },
  { href: '/game/minecraft/items',         slug: 'minecraft-items',    name: 'Minecraft Items',   game: 'Minecraft', iconSrc: getGameIcon('minecraft'),         fromPrice:   1.50, listingCount:  5400 },
  { href: '/game/pubg/items',              slug: 'pubg-items',         name: 'PUBG Skins',        game: 'PUBG',      iconSrc: getGameIcon('pubg'),              fromPrice:   2.40, listingCount:  2900 },
  { href: '/game/free-fire/items',         slug: 'ff-items',           name: 'Free Fire Items',   game: 'Free Fire', iconSrc: getGameIcon('free-fire'),         fromPrice:   1.10, listingCount:  6300 },
  { href: '/game/fc25/items',              slug: 'fc25-items',         name: 'FC 25 Cards',       game: 'FC 25',     iconSrc: getGameIcon('fc25'),              fromPrice:   3.60, listingCount:  4700 },
  { href: '/game/rainbow-six-siege/items', slug: 'r6-items',           name: 'R6 Skins',          game: 'Siege',     iconSrc: getGameIcon('rainbow-six-siege'), fromPrice:   2.90, listingCount:  2100 },
  { href: '/game/escape-from-tarkov/items',slug: 'tarkov-items',       name: 'Tarkov Loot',       game: 'Tarkov',    iconSrc: getGameIcon('escape-from-tarkov'),fromPrice:   4.00, listingCount:  1700 },
  { href: '/game/cs2/items?type=knives',   slug: 'cs2-knives',         name: 'CS2 Knives',        game: 'CS2',       iconSrc: getGameIcon('cs2'),               fromPrice:  45.00, listingCount:   980 },
  { href: '/game/fortnite/items?type=og',  slug: 'fortnite-og',        name: 'Fortnite OG',       game: 'Fortnite',  iconSrc: getGameIcon('fortnite'),          fromPrice:  12.00, listingCount:  1400 },
  { href: '/game/roblox/items?type=limited', slug: 'roblox-limited',   name: 'Roblox Limiteds',   game: 'Roblox',    iconSrc: getGameIcon('roblox'),            fromPrice:  15.00, listingCount:  2300 },
  { href: '/game/valorant/items?type=knives', slug: 'val-knives',      name: 'VAL Knives',        game: 'Valorant',  iconSrc: getGameIcon('valorant'),          fromPrice:  20.00, listingCount:   750 },
  { href: '/game/league-of-legends/items?type=chromas', slug: 'lol-chromas', name: 'League Chromas', game: 'League',  iconSrc: getGameIcon('league-of-legends'),fromPrice:   1.80, listingCount:  3400 },
]

const MOCK_ACCOUNTS: CategoryCard[] = [
  { href: '/game/valorant/accounts',          slug: 'valorant-acc',  name: 'Valorant Accounts',   game: 'Valorant',  iconSrc: getGameIcon('valorant'),          fromPrice:  12.00, listingCount:  8400 },
  { href: '/game/league-of-legends/accounts', slug: 'league-acc',    name: 'League Accounts',     game: 'League',    iconSrc: getGameIcon('league-of-legends'), fromPrice:   8.50, listingCount:  6200 },
  { href: '/game/genshin-impact/accounts',    slug: 'genshin-acc',   name: 'Genshin Accounts',    game: 'Genshin',   iconSrc: getGameIcon('genshin-impact'),    fromPrice:  20.00, listingCount:  3100 },
  { href: '/game/call-of-duty/accounts',      slug: 'cod-acc',       name: 'Warzone Accounts',    game: 'Warzone',   iconSrc: getGameIcon('call-of-duty'),      fromPrice:  15.00, listingCount:  2800 },
  { href: '/game/fortnite/accounts',          slug: 'fortnite-acc',  name: 'Fortnite Accounts',   game: 'Fortnite',  iconSrc: getGameIcon('fortnite'),          fromPrice:  10.00, listingCount:  7600 },
  { href: '/game/cs2/accounts',               slug: 'cs2-acc',       name: 'CS2 Accounts',        game: 'CS2',       iconSrc: getGameIcon('cs2'),               fromPrice:   6.00, listingCount:  5300 },
  { href: '/game/roblox/accounts',            slug: 'roblox-acc',    name: 'Roblox Accounts',     game: 'Roblox',    iconSrc: getGameIcon('roblox'),            fromPrice:   4.50, listingCount: 11200 },
  { href: '/game/apex-legends/accounts',      slug: 'apex-acc',      name: 'Apex Accounts',       game: 'Apex',      iconSrc: getGameIcon('apex-legends'),      fromPrice:  18.00, listingCount:  1900 },
  { href: '/game/gta-v/accounts',             slug: 'gta-acc',       name: 'GTA V Accounts',      game: 'GTA V',     iconSrc: getGameIcon('gta-v'),             fromPrice:  25.00, listingCount:  2400 },
  { href: '/game/minecraft/accounts',         slug: 'minecraft-acc', name: 'Minecraft Accounts',  game: 'Minecraft', iconSrc: getGameIcon('minecraft'),         fromPrice:   3.50, listingCount:  4900 },
  { href: '/game/pubg/accounts',              slug: 'pubg-acc',      name: 'PUBG Accounts',       game: 'PUBG',      iconSrc: getGameIcon('pubg'),              fromPrice:   7.00, listingCount:  2200 },
  { href: '/game/free-fire/accounts',         slug: 'ff-acc',        name: 'Free Fire Accounts',  game: 'Free Fire', iconSrc: getGameIcon('free-fire'),         fromPrice:   3.00, listingCount:  3800 },
  { href: '/game/fc25/accounts',              slug: 'fc25-acc',      name: 'FC 25 Accounts',      game: 'FC 25',     iconSrc: getGameIcon('fc25'),              fromPrice:  14.00, listingCount:  1600 },
  { href: '/game/rainbow-six-siege/accounts', slug: 'r6-acc',        name: 'R6 Siege Accounts',   game: 'Siege',     iconSrc: getGameIcon('rainbow-six-siege'), fromPrice:  11.00, listingCount:  1800 },
  { href: '/game/escape-from-tarkov/accounts',slug: 'tarkov-acc',    name: 'Tarkov Accounts',     game: 'Tarkov',    iconSrc: getGameIcon('escape-from-tarkov'),fromPrice:  35.00, listingCount:   620 },
  { href: '/game/valorant/accounts?tier=radiant', slug: 'val-radiant', name: 'Radiant Accounts',  game: 'Valorant',  iconSrc: getGameIcon('valorant'),          fromPrice: 180.00, listingCount:   140 },
  { href: '/game/league-of-legends/accounts?tier=challenger', slug: 'lol-challenger', name: 'Challenger Accounts', game: 'League', iconSrc: getGameIcon('league-of-legends'), fromPrice: 320.00, listingCount:    85 },
  { href: '/game/genshin-impact/accounts?tier=ar60', slug: 'genshin-ar60', name: 'AR 60 Accounts', game: 'Genshin',  iconSrc: getGameIcon('genshin-impact'),    fromPrice: 120.00, listingCount:   430 },
  { href: '/game/call-of-duty/accounts?type=skin', slug: 'cod-skins-acc', name: 'CoD Skin Accounts', game: 'Warzone', iconSrc: getGameIcon('call-of-duty'),    fromPrice:  45.00, listingCount:   720 },
  { href: '/game/fortnite/accounts?type=og',  slug: 'fortnite-og-acc', name: 'OG Fortnite Accs',  game: 'Fortnite',  iconSrc: getGameIcon('fortnite'),          fromPrice:  60.00, listingCount:   980 },
]

/**
 * Top-Ups & Gift Cards — separate section, uses CurrencyCard layout.
 * Kept as PopularCurrency[] since cards render identically.
 */
const MOCK_TOPUPS: PopularCurrency[] = [
  { slug: 'steam-wallet',     name: 'Steam Wallet',     game: 'Steam',    iconSrc: getGameIcon('steam'),          fromPrice: 46.00, badges: ['instant', 'Global'] },
  { slug: 'roblox-gift-card', name: 'Roblox Gift Card', game: 'Roblox',   iconSrc: getGameIcon('roblox'),         fromPrice: 22.50, badges: ['instant'] },
  { slug: 'v-bucks-card',     name: 'V-Bucks Card',     game: 'Fortnite', iconSrc: getGameIcon('fortnite'),       fromPrice: 28.00, badges: ['instant'] },
  { slug: 'valorant-topup',   name: 'Valorant Top-up',  game: 'Valorant', iconSrc: getGameIcon('valorant'),       fromPrice: 16.40, badges: [] },
  { slug: 'genesis-topup',    name: 'Genesis Top-up',   game: 'Genshin',  iconSrc: getGameIcon('genshin-impact'), fromPrice: 44.00, badges: ['instant'] },
]

export function usePopularItems() {
  // TODO(supabase): replace mock with real query
  return useQuery({
    queryKey: ['popular-items'],
    queryFn: async (): Promise<CategoryCard[]> => MOCK_ITEMS,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePopularAccounts() {
  // TODO(supabase): replace mock with real query
  return useQuery({
    queryKey: ['popular-accounts'],
    queryFn: async (): Promise<CategoryCard[]> => MOCK_ACCOUNTS,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePopularTopups() {
  // TODO(supabase): replace mock with real query
  return useQuery({
    queryKey: ['popular-topups'],
    queryFn: async (): Promise<PopularCurrency[]> => MOCK_TOPUPS,
    staleTime: 5 * 60 * 1000,
  })
}
