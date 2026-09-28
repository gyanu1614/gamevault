/**
 * The order page's item title, with the amount bought.
 *
 *  - Flexible currency (priced per unit / K / M): "2,000 - Roblox Robux",
 *    "100 M - Blade Ball Tokens" (K/M games count in thousands/millions).
 *  - Anything else bought more than once (items, bundles): "3 × Title".
 *  - A single item: the listing title as is.
 *
 * A currency title that already starts with a number ("10,000 Robux Pack")
 * falls back to the "× " form so the two numbers never run together.
 */

import type { QuantityGranularity } from '@/lib/currency/quantity-unit'

export function orderDisplayTitle(opts: {
  title: string
  quantity: number | null | undefined
  /** game_categories.type === 'currency' */
  isCurrency: boolean
  /** Currency config's quantity_granularity (null when not loaded). */
  granularity?: QuantityGranularity | null
  /** Currency config sells fixed bundles, so quantity counts bundles. */
  hasBundles?: boolean
  /** Currency config's unit_label ("Robux", "Diamonds"): a flexible
   *  currency reads "2,000 Robux", with no game name. */
  unitLabel?: string | null
  /** The bundle this listing sells ("50 Diamonds"), from the config. */
  bundleName?: string | null
}): string {
  const title = opts.title.trim()
  const qty = Number(opts.quantity ?? 1)
  const bundle = opts.isCurrency ? opts.bundleName?.trim() : ''
  if (!Number.isFinite(qty) || qty <= 0) return bundle || title

  // A bundle order is "50 Diamonds" (or "2 × 50 Diamonds"), never the
  // seller's listing title, which usually repeats the game name.
  if (bundle) return qty > 1 ? `${qty.toLocaleString('en-US')} × ${bundle}` : bundle

  const flexibleCurrency = opts.isCurrency && !opts.hasBundles
  if (flexibleCurrency) {
    const magnitude =
      opts.granularity === 'thousand' ? ' K' : opts.granularity === 'million' ? ' M' : ''
    const unit = opts.unitLabel?.trim()
    if (unit) return `${qty.toLocaleString('en-US')}${magnitude} ${unit}`
    // No config loaded: the older "<amount> - <listing title>" form.
    if (!/^\d/.test(title)) return `${qty.toLocaleString('en-US')}${magnitude} - ${title}`
  }
  return qty > 1 ? `${qty.toLocaleString('en-US')} × ${title}` : title
}

/** The fields of a game's currency config (category_configs.config) that
 *  name and picture what an order sold. */
export interface CurrencyTitleConfig {
  unit_label?: string | null
  quantity_granularity?: string | null
  currency_icon_url?: string | null
  bundles?: Array<{ id?: string | null; name?: string | null; icon_url?: string | null }> | null
}

function bundleOf(cfg: CurrencyTitleConfig | null | undefined, bundleId: string | null | undefined) {
  if (!cfg || !bundleId || !Array.isArray(cfg.bundles)) return undefined
  return cfg.bundles.find((b) => b?.id === bundleId)
}

/**
 * What an order sold, for every surface that names it (order page, lists,
 * wallet, emails, notifications): "50 Diamonds", "2,000 Robux",
 * "3 × Dragon Pet". The game name is shown separately, never in here.
 */
export function orderItemTitle(opts: {
  listingTitle: string | null | undefined
  quantity: number | null | undefined
  /** game_categories.type of the listing's category. */
  categoryType: string | null | undefined
  currencyConfig?: CurrencyTitleConfig | null
  bundleId?: string | null
}): string {
  const isCurrency = opts.categoryType === 'currency'
  const cfg = isCurrency ? opts.currencyConfig ?? null : null
  const g = cfg?.quantity_granularity
  return orderDisplayTitle({
    title: opts.listingTitle?.trim() || 'Order',
    quantity: opts.quantity,
    isCurrency,
    granularity: g === 'unit' || g === 'thousand' || g === 'million' ? g : null,
    hasBundles: Array.isArray(cfg?.bundles) && cfg!.bundles!.length > 0,
    unitLabel: cfg?.unit_label ?? null,
    bundleName: bundleOf(cfg, opts.bundleId)?.name ?? null,
  })
}

/**
 * The picture of what was sold: the bundle's icon, else the currency's icon
 * (currency orders), else the listing's first image. Never the game's image;
 * null when there is nothing item-specific (callers show a neutral tile).
 */
export function orderItemImage(opts: {
  categoryType: string | null | undefined
  currencyConfig?: CurrencyTitleConfig | null
  bundleId?: string | null
  listingImage: string | null | undefined
}): string | null {
  if (opts.categoryType === 'currency') {
    const cfg = opts.currencyConfig ?? null
    return (
      bundleOf(cfg, opts.bundleId)?.icon_url ||
      cfg?.currency_icon_url ||
      opts.listingImage ||
      null
    )
  }
  return opts.listingImage || null
}
