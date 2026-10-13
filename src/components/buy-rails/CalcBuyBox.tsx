'use client'

import Link from '@/components/navigation/AppLink'
import { track } from '@/lib/analytics/client'
import { calcBuySummary, type CalcItem } from '@/lib/buy-rails/model'
import { formatUsd } from '@/lib/value-listings/format'
import { itemBuyHref } from '@/lib/value-listings/buy-state'
import type { ListStock } from './ListBuy'
import { useRailTracking } from './useRailTracking'
import { useSellHref } from './useSellHref'
import { RailButton } from './RailButton'

export interface CalcBuyData {
  gameSlug: string
  gameName: string
  /** The game's items page, e.g. /adopt-me/buy-items. */
  itemsHref: string
  categorySlug: string
  /** Per item; `byVariant` (SAB mutations) prices a variant the trade names. */
  stock: Record<string, ListStock[string] & { byVariant?: Record<string, { count: number; minPriceUsd: number }> }>
}

/**
 * The calculator's buy box (growth point 2), under the result:
 * "3 of 4 items in stock · Get them from $65", each stocked item linking to
 * its own offers, and one white button to the game's items page. Nothing in
 * stock → the seller ask instead. Empty trade → nothing.
 */
export function CalcBuyBox({ data, items }: { data: CalcBuyData; items: CalcItem[] }) {
  // Mount the tracked box only with a trade, so its view is logged when it appears.
  return items.length > 0 ? <Box data={data} items={items} /> : null
}

function Box({ data, items }: { data: CalcBuyData; items: CalcItem[] }) {
  const stock = Object.fromEntries(Object.entries(data.stock).map(([k, v]) => [k, { ...v, byVariant: v.byVariant ?? {} }]))
  const summary = calcBuySummary(items, stock)
  const variant = summary ? 'buy' : 'sell'
  const { ref, onClick } = useRailTracking<HTMLDivElement>({ surface: 'calculator', position: 'box', game: data.gameSlug, item: null, variant })
  const sell = useSellHref({ game: data.gameSlug, categoryType: 'items' }, 'calc-box')

  return (
    <div ref={ref} className="flex flex-col gap-4 rounded-[8px] bg-[#1D1E23] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <p className="text-body font-medium text-white">
          {summary ? summary.line : `Have ${items.length === 1 ? 'this item' : 'these items'}? · No sellers yet · list ${items.length === 1 ? 'it' : 'them'} first`}
        </p>
        {summary && (
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-body-sm text-[#9A9DA6]">
            {dedupe(summary.stocked).map((i) => (
              <Link
                key={i.slug}
                href={itemBuyHref({ gameSlug: data.gameSlug, categorySlug: data.categorySlug, itemSlug: i.slug })}
                onClick={() => track('rail_clicked', { surface: 'calculator', position: 'box', game: data.gameSlug, item: i.slug, variant: 'buy' })}
                className="rounded-sm tabular-nums transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {i.name} <span className="text-[#D4D6DC]">{formatUsd(i.minUsd)}</span>
              </Link>
            ))}
          </p>
        )}
      </div>
      <RailButton href={summary ? data.itemsHref : sell} onClick={onClick} className="h-11 shrink-0 px-5 text-body-sm">
        {summary ? `Shop ${data.gameName} Items` : 'Sell'}
      </RailButton>
    </div>
  )
}

/** One link per item, even when the trade holds it twice. */
function dedupe<T extends { slug: string }>(list: T[]): T[] {
  const seen = new Set<string>()
  return list.filter((i) => (seen.has(i.slug) ? false : (seen.add(i.slug), true)))
}
