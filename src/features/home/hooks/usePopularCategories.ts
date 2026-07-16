import { useQuery } from '@tanstack/react-query'
import {
  fetchPopularCategoryGroups,
  groupsOfType,
  type PopularCategoryGroup,
} from '../lib/popular-listings'
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

/**
 * Shape one aggregated (game, category) group into a CategoryCard.
 * The card links to the real marketplace path — /{gameSlug}/{categorySlug}
 * — the same URL scheme usePopularGames uses.
 */
function toCategoryCard(g: PopularCategoryGroup): CategoryCard {
  return {
    href: `/${g.gameSlug}/${g.categorySlug}`,
    slug: `${g.gameSlug}-${g.categorySlug}`,
    name: g.categoryName,
    game: g.gameName,
    iconSrc: g.gameIcon,
    fromPrice: g.fromPrice,
    listingCount: g.listingCount,
  }
}

export function usePopularItems() {
  return useQuery({
    queryKey: ['popular-items'],
    queryFn: async (): Promise<CategoryCard[]> => {
      const groups = await fetchPopularCategoryGroups()
      return groupsOfType(groups, 'items').map(toCategoryCard)
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function usePopularAccounts() {
  return useQuery({
    queryKey: ['popular-accounts'],
    queryFn: async (): Promise<CategoryCard[]> => {
      const groups = await fetchPopularCategoryGroups()
      return groupsOfType(groups, 'accounts').map(toCategoryCard)
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function usePopularTopups() {
  return useQuery({
    queryKey: ['popular-topups'],
    queryFn: async (): Promise<PopularCurrency[]> => {
      const groups = await fetchPopularCategoryGroups()
      return groupsOfType(groups, 'top-up').map((g) => ({
        slug: `${g.gameSlug}/${g.categorySlug}`,
        name: g.categoryName,
        game: g.gameName,
        iconSrc: g.gameIcon,
        fromPrice: g.fromPrice,
        badges: [],
      }))
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}
