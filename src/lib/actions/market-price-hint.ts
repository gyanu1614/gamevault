'use server'

/**
 * Sell wizard market price helper (growth point 30): "Estimated market price
 * $X, based on N offers". Advice only — publish never reads it.
 *
 * Public data only (value prices + live offers, both anon-readable), read
 * through cached cookie-free loaders, so no session lookup on this path.
 */

import { parseHintInput } from '@/lib/price-helper/input'
import { getMarketPriceHint } from '@/lib/price-helper/server'
import type { MarketPriceHint } from '@/lib/price-helper/resolve'

export async function fetchMarketPriceHint(raw: unknown): Promise<MarketPriceHint | null> {
  const input = parseHintInput(raw)
  if (!input) return null
  return getMarketPriceHint(input)
}
