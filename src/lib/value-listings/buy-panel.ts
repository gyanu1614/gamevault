/**
 * The value hero's price column (owner, 2026-10-14). Whatever number a buyer
 * sees first becomes their reference, so a big market price above our higher
 * listing made the listing read as overpriced. When DropMarket has the chosen
 * variant, the headline is OUR price (the one the button buys at) and the
 * market price is a small reference under it, with the saving when we are
 * clearly under it. Without our stock the headline is the TYPICAL market price
 * (never the cheapest relabelled as "Market Price"). Pure.
 */
import type { BuyState } from './buy-state'
import { marketSecondaryUsd } from '@/lib/values/pricing'

/** Our price must be this far under market before we call it a saving. */
const SAVE_MIN_RATIO = 0.98

export interface BuyPanel {
  label: string
  /** Headline dollars; null leaves the headline to the caller (trade value, "No data yet"). */
  usd: number | null
  /** Several of our offers: the headline is the lowest ("from"). */
  from: boolean
  reference: { label: string; usd: number } | null
  saveUsd: number | null
}

export function buyPanel(input: {
  kind: BuyState['kind']
  /** Our lowest price for the state (the button's), null when none. */
  ourUsd: number | null
  count: number
  /** Typical reputable price (average). */
  marketUsd: number | null
  cheapestUsd: number | null
  marketLabel?: string
}): BuyPanel {
  const { kind, ourUsd, count, marketUsd, cheapestUsd, marketLabel = 'Market Price' } = input
  const market = marketUsd ?? cheapestUsd

  if (kind === 'in_stock' && ourUsd != null) {
    const save = market != null && ourUsd <= market * SAVE_MIN_RATIO ? Math.round((market - ourUsd) * 100) / 100 : null
    return {
      label: 'On DropMarket',
      usd: ourUsd,
      from: count > 1,
      reference: market != null ? { label: marketLabel, usd: market } : null,
      saveUsd: save,
    }
  }

  const lower = marketSecondaryUsd(cheapestUsd, marketUsd) != null ? cheapestUsd : null
  return {
    label: marketUsd != null ? marketLabel : cheapestUsd != null ? 'Cheapest Price' : marketLabel,
    usd: market,
    from: false,
    reference: lower != null ? { label: 'Cheapest', usd: lower } : null,
    saveUsd: null,
  }
}

/**
 * The hero headline when there is no price (owner, 2026-10-21; every hub):
 * the trade value when there is one, else "No Trades Yet", labelled New for an
 * item released or added in the last 14 days (isNewItem).
 */
export function noPriceFallback({
  tradeValue,
  tradeLabel = 'Value',
  isNew,
}: {
  tradeValue?: string | null
  tradeLabel?: string
  isNew: boolean
}): { label: string; value: string } {
  if (tradeValue) return { label: tradeLabel, value: tradeValue }
  return { label: isNew ? 'New' : 'Value', value: 'No Trades Yet' }
}
