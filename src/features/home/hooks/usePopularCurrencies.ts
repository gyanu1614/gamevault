import { useQuery } from '@tanstack/react-query'
import { fetchPopularCategoryGroups, groupsOfType } from '../lib/popular-listings'

export interface PopularCurrency {
  slug: string
  name: string
  game: string
  iconSrc: string
  fromPrice: number
  badges?: ('instant' | string)[]
}

export function usePopularCurrencies() {
  return useQuery({
    queryKey: ['popular-currencies'],
    queryFn: async (): Promise<PopularCurrency[]> => {
      const groups = await fetchPopularCategoryGroups()
      return groupsOfType(groups, 'currency').map((g) => ({
        // Real marketplace path segment: /{gameSlug}/{categorySlug}.
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
