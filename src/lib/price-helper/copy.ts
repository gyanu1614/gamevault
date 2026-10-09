import { formatUnitPrice } from '@/lib/currency/price-format'
import type { MarketPriceHint } from './resolve'

export interface HintCopy {
  price: string
  /** "per K", "per Robux", "per bundle"; null for a single item. */
  per: string | null
  /** "from 18 sources" — how many offers back the price. */
  sources: string
}

export function hintCopy(hint: MarketPriceHint, unit: string | null): HintCopy {
  const isCurrency = hint.kind === 'currency'
  return {
    price: isCurrency ? formatUnitPrice(hint.usd) : `$${hint.usd.toFixed(2)}`,
    per: isCurrency && unit ? `per ${unit}` : null,
    sources: `from ${hint.offers} sources`,
  }
}
