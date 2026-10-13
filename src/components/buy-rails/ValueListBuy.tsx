import type { ReactNode } from 'react'
import { getGameRails, getRailSettings } from '@/lib/buy-rails/server'
import { barCard } from '@/lib/buy-rails/model'
import { getValueStock } from '@/lib/value-listings/stock-server'
import { BuyBar } from './BuyBar'
import { ListBuyProvider, type ListStock } from './ListBuy'

/**
 * Value list pages (/[game]/values): no rails (they would squeeze the grid).
 * Each card's Buy line reads the game's live stock from here, and the phone
 * bar carries the game's items card. The stock is the same cached per-game
 * read the calculator uses (tagged with the items pair's listings tag, so a
 * listing change refreshes it). Off (admin switch) → children as before.
 */
export async function ValueListBuy({ gameSlug, children }: { gameSlug: string; children: ReactNode }) {
  const settings = await getRailSettings()
  if (!settings.value_list) return <>{children}</>
  const [stock, rails] = await Promise.all([getValueStock(gameSlug), getGameRails(gameSlug)])
  const bar = barCard(rails)
  // Only stocked items, and only the two numbers the line needs.
  const compact: ListStock = {}
  for (const [slug, s] of Object.entries(stock?.byItem ?? {})) {
    if (s.total > 0 && s.minPriceUsd != null) compact[slug] = { total: s.total, minPriceUsd: s.minPriceUsd }
  }
  return (
    <>
      <ListBuyProvider value={{ gameSlug, categorySlug: stock?.pair.categorySlug ?? 'buy-items', stock: compact }}>
        {children}
      </ListBuyProvider>
      {bar && <BuyBar card={bar} surface="value_list" mode="immediate" />}
    </>
  )
}
