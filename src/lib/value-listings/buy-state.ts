/**
 * The value-page buy button's three states, from DropMarket's OWN live
 * listings (never market data — the button must not promise a price a buyer
 * can't get here). Pure; the caller supplies the item's stock.
 *
 *   in_stock        "Buy From $X"                  → variant (or item) page
 *   other_variants  "See N Other Listings From $Y" → item page
 *   none            "Browse Similar Items" + sell  → item page (fallbacks)
 */

import { formatUsd } from './format'

export interface VariantStock {
  count: number
  /** Cheapest unit price among these listings. */
  minPriceUsd: number
}

export interface ItemStock {
  /** Every live listing of the item, including ones with an unknown variant. */
  total: number
  minPriceUsd: number | null
  /** Keyed by variant; listings with no known variant are only in the totals. */
  byVariant: Record<string, VariantStock>
}

export type BuyState =
  | { kind: 'in_stock'; priceUsd: number; count: number; href: string }
  | { kind: 'other_variants'; priceUsd: number; count: number; href: string }
  | { kind: 'none'; similarHref: string }

interface ItemRef {
  gameSlug: string
  categorySlug: string
  itemSlug: string
  variant?: string | null
}

export function itemBuyHref({ gameSlug, categorySlug, itemSlug, variant }: ItemRef): string {
  const base = `/${gameSlug}/${categorySlug}/item/${encodeURIComponent(itemSlug)}`
  return variant ? `${base}/${encodeURIComponent(variant)}` : base
}

export function resolveBuyState(input: ItemRef & { stock: ItemStock | null | undefined }): BuyState {
  const { stock, variant } = input
  const itemHref = itemBuyHref({ ...input, variant: null })

  if (!stock || stock.total <= 0 || stock.minPriceUsd == null) {
    return { kind: 'none', similarHref: itemHref }
  }

  if (!variant) {
    return { kind: 'in_stock', priceUsd: stock.minPriceUsd, count: stock.total, href: itemHref }
  }

  const own = stock.byVariant[variant]
  if (own && own.count > 0) {
    return { kind: 'in_stock', priceUsd: own.minPriceUsd, count: own.count, href: itemBuyHref(input) }
  }

  return { kind: 'other_variants', priceUsd: stock.minPriceUsd, count: stock.total, href: itemHref }
}

/**
 * The button's words for a state (owner-approved copy table, 2026-10-02).
 * `variantName` is what the sub-line says is missing ("Diamond", "Neon");
 * the caller passes the item name for a game's default variant.
 * State 3's "Tell Me When One Is Listed" arrives with task D (alerts).
 */
export function buyCtaCopy(state: BuyState, variantName: string): { label: string; subline: string | null } {
  switch (state.kind) {
    case 'in_stock':
      return { label: `Buy From ${formatUsd(state.priceUsd)}`, subline: null }
    case 'other_variants':
      return {
        label: `See ${state.count} Other ${state.count === 1 ? 'Listing' : 'Listings'} From ${formatUsd(state.priceUsd)}`,
        subline: `${variantName} not listed right now`,
      }
    case 'none':
      return { label: 'Browse Similar Items', subline: null }
  }
}
