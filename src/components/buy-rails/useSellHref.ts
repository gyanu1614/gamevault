'use client'

import { useAuth } from '@/hooks/use-auth'
import { sellHref, type RailCard } from '@/lib/buy-rails/model'

/**
 * Where a sell card's button goes, decided in the browser (pages stay
 * static): approved sellers → the prefilled sell wizard, everyone else →
 * /founding. While auth loads, and in the static HTML, it is /founding —
 * the one crawlable seller entry.
 */
export function useSellHref(card: Pick<RailCard, 'game' | 'categoryType'>, src: string): string {
  const { user, loading } = useAuth()
  const isSeller = !loading && !!user?.isApprovedSeller
  return sellHref(isSeller, { gameSlug: card.game, categoryType: card.categoryType }, src)
}
