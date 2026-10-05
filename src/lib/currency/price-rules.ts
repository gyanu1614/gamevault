/**
 * The admin's price rules for one currency, read the same way by the
 * listing validator, the seller wizard and the admin form.
 *
 *   flexible (no bundles)  min `price_floor`, max `price_max` — per unit of
 *                          granularity (per Robux, per K, per M), the same
 *                          unit `listings.price` is stored in.
 *   bundles                min `bundle_price_min`, max `bundle_price_max` —
 *                          per bundle (a bundle listing's price is the
 *                          price of one bundle).
 *
 * Unset (missing, null, 0, junk) means no rule. A maximum applies only when
 * an admin set one.
 *
 * Back compat (blobs saved before 2026-10-04):
 *   · `price_ceiling` was a per-unit maximum the admin form never showed;
 *     DEFAULT_CURRENCY_CONFIG gave it 10 and the form saved that default into
 *     every row, so "$10" is not a rule anyone chose. It is read only when
 *     `price_max` is absent and only when it is not that default (Roblox's
 *     $0.008 was set on purpose and stays). It never applies to bundles.
 *   · In bundle mode the old form labelled `price_floor` "Minimum Listing
 *     Price ($)", so it stays the per-bundle minimum until an admin saves
 *     `bundle_price_min`.
 * Saving the form writes the explicit keys and drops `price_ceiling`.
 */
import { roundRuleAmount } from './price-format'

/** The value DEFAULT_CURRENCY_CONFIG carried before 2026-10-04 (see above). */
export const LEGACY_DEFAULT_PRICE_CEILING = 10

export type PricingMode = 'flexible' | 'bundles'

export interface CurrencyPriceRules {
  mode: PricingMode
  /** Lowest accepted price (per unit, or per bundle in bundle mode); null = none. */
  min: number | null
  /** Highest accepted price; null = no cap. */
  max: number | null
}

/** The slice of CurrencyConfig these rules read (all optional: old blobs). */
export interface PriceRuleConfig {
  price_floor?: number | null
  price_ceiling?: number | null
  price_max?: number | null
  bundle_price_min?: number | null
  bundle_price_max?: number | null
  bundles?: unknown[] | null
}

function positive(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

const has = (cfg: object, key: string) => Object.prototype.hasOwnProperty.call(cfg, key)

export function currencyPricingMode(cfg: PriceRuleConfig | null | undefined): PricingMode {
  return Array.isArray(cfg?.bundles) && cfg.bundles.length > 0 ? 'bundles' : 'flexible'
}

export function resolveCurrencyPriceRules(cfg: PriceRuleConfig | null | undefined): CurrencyPriceRules {
  const mode = currencyPricingMode(cfg)
  const r = priceRuleInputsOf(cfg)
  return mode === 'bundles'
    ? { mode, min: r.bundleMin, max: r.bundleMax }
    : { mode, min: r.unitMin, max: r.unitMax }
}

export interface PriceRuleInputs {
  unitMin: number | null
  unitMax: number | null
  bundleMin: number | null
  bundleMax: number | null
}

/**
 * Both modes' rules from a blob (the admin form edits both; only the current
 * mode's pair is enforced). A legacy bundle-mode `price_floor` moves to the
 * bundle minimum, so saving never turns it into a per-unit rule.
 */
export function priceRuleInputsOf(cfg: PriceRuleConfig | null | undefined): PriceRuleInputs {
  if (!cfg) return { unitMin: null, unitMax: null, bundleMin: null, bundleMax: null }
  const bundleMode = currencyPricingMode(cfg) === 'bundles'
  const legacyBundleFloor = bundleMode && !has(cfg, 'bundle_price_min')
  let unitMax: number | null
  if (has(cfg, 'price_max')) {
    unitMax = positive(cfg.price_max)
  } else {
    const legacy = positive(cfg.price_ceiling)
    unitMax = legacy === LEGACY_DEFAULT_PRICE_CEILING ? null : legacy
  }
  return {
    unitMin: legacyBundleFloor ? null : positive(cfg.price_floor),
    unitMax,
    bundleMin: has(cfg, 'bundle_price_min')
      ? positive(cfg.bundle_price_min)
      : bundleMode
        ? positive(cfg.price_floor)
        : null,
    bundleMax: positive(cfg.bundle_price_max),
  }
}

/** How many single units one listing unit is. */
export function granularityMultiplier(g: 'unit' | 'thousand' | 'million' | null | undefined): number {
  return g === 'thousand' ? 1_000 : g === 'million' ? 1_000_000 : 1
}

/**
 * The config blob with the admin's rules written as explicit keys. The
 * legacy `price_ceiling` is removed so its default can never return.
 * `price_floor` stays a number (0 = none) — older readers expect one.
 */
export function priceRulesForSave<T extends PriceRuleConfig>(
  cfg: T,
  rules: PriceRuleInputs,
): Omit<T, 'price_ceiling'> & {
  price_floor: number
  price_max: number | null
  bundle_price_min: number | null
  bundle_price_max: number | null
} {
  const clean = (v: number | null) => (v != null && Number.isFinite(v) && v > 0 ? roundRuleAmount(v) : null)
  const { price_ceiling: _legacy, ...rest } = cfg
  void _legacy
  return {
    ...rest,
    price_floor: clean(rules.unitMin) ?? 0,
    price_max: clean(rules.unitMax),
    bundle_price_min: clean(rules.bundleMin),
    bundle_price_max: clean(rules.bundleMax),
  }
}
