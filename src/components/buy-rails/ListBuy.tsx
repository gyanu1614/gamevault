'use client'

import { createContext, useContext, type ReactNode } from 'react'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import Link from '@/components/navigation/AppLink'
import { track } from '@/lib/analytics/client'
import { listBuyLabel } from '@/lib/buy-rails/model'
import { itemBuyHref, type ItemStock } from '@/lib/value-listings/buy-state'

/**
 * The value list's Buy line (growth point 2): every card gets a bottom row,
 * "From $42 →" to that item's offers when we have stock, "—" when not. The
 * list page's server wrapper (ValueListBuy) provides the game's live stock;
 * outside a provider the row renders nothing, so cards elsewhere are unchanged.
 */
export type ListStock = Record<string, Pick<ItemStock, 'total' | 'minPriceUsd'>>

interface ListBuyValue {
  gameSlug: string
  categorySlug: string
  stock: ListStock
}

const ListBuyContext = createContext<ListBuyValue | null>(null)

export function ListBuyProvider({ value, children }: { value: ListBuyValue; children: ReactNode }) {
  return <ListBuyContext.Provider value={value}>{children}</ListBuyContext.Provider>
}

export function ListBuyRow({ slug }: { slug: string }) {
  const ctx = useContext(ListBuyContext)
  if (!ctx) return null
  const s = ctx.stock[slug]
  const label = listBuyLabel(s ? { ...s, byVariant: {} } : null)
  if (!label) {
    return (
      <div className="border-t border-white/[0.07] px-3 py-2 text-center text-[13px] text-text-tertiary">
        <span aria-hidden>—</span>
        <span className="sr-only">No offers yet</span>
      </div>
    )
  }
  return (
    <Link
      href={itemBuyHref({ gameSlug: ctx.gameSlug, categorySlug: ctx.categorySlug, itemSlug: slug })}
      onClick={() => track('rail_clicked', { surface: 'value_list', position: 'column', game: ctx.gameSlug, item: slug, variant: 'buy' })}
      className="flex items-center justify-center gap-1 border-t border-white/[0.07] px-3 py-2 text-[13px] font-semibold tabular-nums text-text-primary transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
    >
      Buy {label}
      <ArrowForwardRounded aria-hidden style={{ fontSize: 14 }} />
    </Link>
  )
}
