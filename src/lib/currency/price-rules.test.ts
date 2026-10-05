/**
 * Admin price rules for a currency (D2/D3, 2026-10-04).
 *
 * The $10 bug: DEFAULT_CURRENCY_CONFIG carried `price_ceiling: 10`, the
 * admin form hydrated new rows from it and saved the whole blob without
 * ever showing a ceiling field, and the validator applied that ceiling to
 * every currency listing — bundle listings included, whose price is per
 * BUNDLE. These pin the fixed reading of a config.
 */
import { describe, it, expect } from 'vitest'
import {
  currencyPricingMode,
  resolveCurrencyPriceRules,
  priceRulesForSave,
  LEGACY_DEFAULT_PRICE_CEILING,
  priceRuleInputsOf,
  granularityMultiplier,
} from './price-rules'

const FORTNITE_PROD = {
  // Read from prod 2026-10-04: the admin form saved the hidden default ceiling.
  price_floor: 10,
  price_ceiling: 10,
  bundles: [{ id: 'vb-12500', name: '12,500 V-Bucks', amount: 12500 }],
}
const NIGHTS_PROD = {
  price_floor: 1,
  price_ceiling: 10,
  bundles: [{ id: 'd-1400', name: '1400 Diamonds', amount: 1400 }],
}
const ROBLOX_PROD = { price_floor: 0.0035, price_ceiling: 0.008, bundles: [] }

describe('currencyPricingMode', () => {
  it('bundles when the config lists at least one bundle, flexible otherwise', () => {
    expect(currencyPricingMode(FORTNITE_PROD)).toBe('bundles')
    expect(currencyPricingMode(ROBLOX_PROD)).toBe('flexible')
    expect(currencyPricingMode({})).toBe('flexible')
    expect(currencyPricingMode(null)).toBe('flexible')
  })
})

describe('resolveCurrencyPriceRules', () => {
  it('the legacy default ceiling ($10) is never a rule — the form never let an admin set it', () => {
    expect(LEGACY_DEFAULT_PRICE_CEILING).toBe(10)
    expect(resolveCurrencyPriceRules(FORTNITE_PROD).max).toBeNull()
    expect(resolveCurrencyPriceRules(NIGHTS_PROD).max).toBeNull()
    expect(resolveCurrencyPriceRules({ price_floor: 1, price_ceiling: 10, bundles: [] }).max).toBeNull()
  })

  it('bundle mode: the legacy floor stays the per-bundle minimum until an admin saves the new fields', () => {
    expect(resolveCurrencyPriceRules(NIGHTS_PROD)).toEqual({ mode: 'bundles', min: 1, max: null })
    expect(
      resolveCurrencyPriceRules({ ...NIGHTS_PROD, bundle_price_min: 0.5, bundle_price_max: 40 }),
    ).toEqual({ mode: 'bundles', min: 0.5, max: 40 })
    // explicit null = the admin cleared it
    expect(resolveCurrencyPriceRules({ ...NIGHTS_PROD, bundle_price_min: null }).min).toBeNull()
  })

  it('a legacy per-unit ceiling the admin really set (not the default) is still honoured', () => {
    expect(resolveCurrencyPriceRules(ROBLOX_PROD)).toEqual({ mode: 'flexible', min: 0.0035, max: 0.008 })
  })

  it('flexible: price_max wins over the legacy ceiling once present; null means no cap', () => {
    expect(resolveCurrencyPriceRules({ ...ROBLOX_PROD, price_max: 0.01 }).max).toBe(0.01)
    expect(resolveCurrencyPriceRules({ ...ROBLOX_PROD, price_max: null }).max).toBeNull()
  })

  it('zero / negative / junk values are "not set"', () => {
    expect(resolveCurrencyPriceRules({ price_floor: 0, price_max: -1, bundles: [] })).toEqual({ mode: 'flexible', min: null, max: null })
    expect(resolveCurrencyPriceRules({ price_floor: 'abc' as unknown as number })).toEqual({ mode: 'flexible', min: null, max: null })
  })

  it('keeps tiny per-unit values exactly (8 decimals)', () => {
    expect(resolveCurrencyPriceRules({ price_floor: 0.0000001, price_max: 0.00000045 })).toEqual({
      mode: 'flexible',
      min: 0.0000001,
      max: 0.00000045,
    })
  })
})

describe('priceRulesForSave', () => {
  it('writes explicit keys and drops the legacy ceiling so it can never come back', () => {
    const saved = priceRulesForSave({ ...ROBLOX_PROD }, { unitMin: 0.004, unitMax: null, bundleMin: null, bundleMax: 25 })
    expect(saved).toMatchObject({ price_floor: 0.004, price_max: null, bundle_price_min: null, bundle_price_max: 25 })
    expect('price_ceiling' in saved).toBe(false)
  })

  it('rounds to 8 decimals and stores an unset minimum as 0 (the floor key is numeric)', () => {
    const saved = priceRulesForSave({}, { unitMin: null, unitMax: 0.123456789, bundleMin: null, bundleMax: null })
    expect(saved.price_floor).toBe(0)
    expect(saved.price_max).toBe(0.12345679)
  })
})

describe('priceRuleInputsOf — what the admin form edits', () => {
  it('a legacy bundle floor becomes the bundle minimum, not a per-unit minimum', () => {
    expect(priceRuleInputsOf(FORTNITE_PROD)).toEqual({ unitMin: null, unitMax: null, bundleMin: 10, bundleMax: null })
  })
  it('a legacy flexible config keeps its unit rules and has no bundle rules', () => {
    expect(priceRuleInputsOf(ROBLOX_PROD)).toEqual({ unitMin: 0.0035, unitMax: 0.008, bundleMin: null, bundleMax: null })
  })
  it('round-trips through priceRulesForSave', () => {
    const saved = priceRulesForSave({ ...FORTNITE_PROD }, priceRuleInputsOf(FORTNITE_PROD))
    expect(resolveCurrencyPriceRules(saved)).toEqual({ mode: 'bundles', min: 10, max: null })
    expect(priceRuleInputsOf(saved)).toEqual(priceRuleInputsOf(FORTNITE_PROD))
  })
})

describe('granularityMultiplier', () => {
  it('unit / K / M', () => {
    expect(granularityMultiplier('unit')).toBe(1)
    expect(granularityMultiplier('thousand')).toBe(1000)
    expect(granularityMultiplier('million')).toBe(1_000_000)
    expect(granularityMultiplier(undefined)).toBe(1)
  })
})
