/**
 * Picks the market price the sell wizard shows for what the seller is listing.
 * Loaders are injected so the rules are tested without a database; the
 * cached, cookie-free loaders live in ./server.ts.
 *
 *   - items on a game with values pricing → match the PICKED form fields (never
 *     the title) to a catalogue item with the matcher publish uses → that
 *     item's market price. Adopt Me also needs its trait picked (FR, NFR…);
 *     a Steal a Brainrot with no mutation picked is the default brainrot.
 *   - currency → the median of the pair's live offers (per bundle in bundle mode).
 *   - anything else, no match, thin data or an error → null (hidden).
 */
import { VALUE_CATALOG_GAMES, type LoadedCatalog } from '@/lib/value-listings/catalogs'
import { matchListingToValueItem } from '@/lib/value-listings/match'
import { currencyMarketPrice, itemMarketPrice, type LiveCurrencyOffer } from './hint'

export interface MarketPriceHint {
  kind: 'item' | 'currency'
  usd: number
  /** How many offers (sources) back the price. */
  offers: number
}

export interface HintInput {
  gameSlug: string
  /** Global category slug: currency | items | accounts | top-up | boosting. */
  categorySlug: string
  gameCategoryId: string
  /** Picked template answers keyed by attribute slug (the publish payload's shape). */
  templateData: Record<string, unknown>
  /** attribute slug → option value → option label. */
  optionLabels?: Record<string, Record<string, string>>
  bundleId?: string | null
}

export interface ItemPriceRow {
  usd: number | null
  offers: number | null
  updatedAt: string | null
  isEstimate?: boolean
}

export interface HintDeps {
  loadCatalog(gameSlug: string): Promise<LoadedCatalog | null>
  loadItemPrice(gameSlug: string, itemSlug: string, variant: string | null): Promise<ItemPriceRow | null>
  loadCurrencyOffers(gameCategoryId: string, bundleId: string | null): Promise<LiveCurrencyOffer[]>
  now?: () => Date
}

/** Games whose items have no single price without a variant (FR vs NFR). */
const VARIANT_REQUIRED: ReadonlySet<string> = new Set(['adopt-me'])

export async function resolveMarketPriceHint(input: HintInput, deps: HintDeps): Promise<MarketPriceHint | null> {
  try {
    if (input.categorySlug === 'currency') {
      const offers = await deps.loadCurrencyOffers(input.gameCategoryId, input.bundleId || null)
      const price = currencyMarketPrice(offers)
      return price ? { kind: 'currency', ...price } : null
    }

    if (input.categorySlug !== 'items' || !VALUE_CATALOG_GAMES.includes(input.gameSlug)) return null
    if (Object.keys(input.templateData).length === 0) return null

    const loaded = await deps.loadCatalog(input.gameSlug)
    if (!loaded) return null
    const match = matchListingToValueItem(
      { title: '', templateData: input.templateData, optionLabels: input.optionLabels },
      loaded.catalog,
    )
    if (!match) return null
    if (!match.variant && VARIANT_REQUIRED.has(input.gameSlug)) return null

    const row = await deps.loadItemPrice(input.gameSlug, match.itemSlug, match.variant)
    const price = row ? itemMarketPrice(row, deps.now?.() ?? new Date()) : null
    return price ? { kind: 'item', usd: price.usd, offers: price.offers } : null
  } catch (e) {
    console.error('[price-helper] hint failed', e instanceof Error ? e.message : e)
    return null
  }
}
