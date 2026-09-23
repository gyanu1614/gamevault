/**
 * fees — single source of truth for ALL platform fees.
 *
 * Implements DropMarket_Fee_Implementation_Spec (12 Jul 2026) exactly.
 * Buyer fee, protection windows, payout and refund rules live HERE and are
 * imported everywhere — no scattered literals (spec §7). The SELLER
 * COMMISSION does not: it is database data behind resolve_seller_fee (see
 * ./resolver.ts). Values marked ADJUSTABLE are plain consts so ops can
 * change them in one place.
 *
 * Money rule: round to 2 dp, half-up. Fee components are rounded
 * individually and summed (so $100 → $5.00 + $2.00 = $7.00 total).
 */

import { accountRiskBand, classifyOfferType, type AccountRiskBand, type OfferType } from '@/lib/utils/offer-type'

// ─── Rounding ────────────────────────────────────────────────────────────────

/** 2-dp half-up rounding (spec §1/§2). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ─── §2 Buyer fee (added on top of item price) ───────────────────────────────

/** ADJUSTABLE — becomes max(5, actual PSP fee) when PSP contracts sign. */
export const BUYER_PROCESSING_FEE_PCT = 5
export const BUYER_MARKETPLACE_FEE_PCT = 2
/** Feature flag for the max(5%, actual PSP fee) logic — OFF until PSP contracts. */
export const BUYER_FEE_USE_PSP_MAX = false
/** Display labels — the buyer fee is shown as two itemised lines
 *  (marketplace 2% + processing 5%), both always in the displayed
 *  total. Never “passthrough”, never hidden. */
export const MARKETPLACE_FEE_LABEL = 'Marketplace fee'
export const PROCESSING_FEE_LABEL = 'Processing fee'

export interface BuyerFee {
  /** Processing component %, after the (flag-gated) max() rule. */
  processingPct: number
  marketplacePct: number
  processingAmount: number
  marketplaceAmount: number
  /** Total fee actually charged to the buyer (sum of rounded components). */
  amount: number
}

/**
 * Buyer fee on a subtotal. `actualPspPct` participates only when
 * BUYER_FEE_USE_PSP_MAX is enabled.
 */
export function buyerFee(subtotal: number, actualPspPct?: number): BuyerFee {
  const processingPct =
    BUYER_FEE_USE_PSP_MAX && typeof actualPspPct === 'number'
      ? Math.max(BUYER_PROCESSING_FEE_PCT, actualPspPct)
      : BUYER_PROCESSING_FEE_PCT
  const processingAmount = round2((subtotal * processingPct) / 100)
  const marketplaceAmount = round2((subtotal * BUYER_MARKETPLACE_FEE_PCT) / 100)
  return {
    processingPct,
    marketplacePct: BUYER_MARKETPLACE_FEE_PCT,
    processingAmount,
    marketplaceAmount,
    amount: round2(processingAmount + marketplaceAmount),
  }
}

// ─── §1 Seller commission ────────────────────────────────────────────────────
// NOT HERE. The seller commission rate is DATA (fee_rules, seller_tier_config
// .discount_pts, platform_fee_settings) resolved by ONE SQL function,
// resolve_seller_fee, through src/lib/fees/resolver.ts — checkout stamps it
// on the order, the sell wizard previews it, /sell/fees publishes it. No
// TypeScript computes a commission percentage (fee-engine.md §8.4); the
// constants that used to live here (COMMISSION_PCT, ROBLOX_ECONOMY_GAMES,
// ACCOUNT_RISK_BANDS as a fee input, FOUNDING_DISCOUNT_PTS, commissionPct,
// commissionAmount, netProceeds) were deleted in fee engine PR 5.

// ─── §1 Protection windows / payout holds (hours) ───────────────────────────

export type { AccountRiskBand }

export const PROTECTION_WINDOW_HOURS = {
  currency: 48,
  items: 72,
  'top-up': 48,
  /** After completion. */
  boosting: 72,
  accounts: { low: 5 * 24, mid: 7 * 24, high: 14 * 24 } as Record<AccountRiskBand, number>,
} as const

export interface ProtectionWindowInput {
  /** game_categories.type for the listing's pair. */
  categoryMetaType?: string | null
  categorySlug?: string | null
  gameSlug?: string | null
}

export function protectionWindowHours(input: ProtectionWindowInput): number {
  const type: OfferType = classifyOfferType(
    input.categoryMetaType ?? undefined,
    input.categorySlug ?? undefined,
  )
  if (type === 'accounts') return PROTECTION_WINDOW_HOURS.accounts[accountRiskBand(input.gameSlug)]
  if (type === 'currency') return PROTECTION_WINDOW_HOURS.currency
  if (type === 'top-up') return PROTECTION_WINDOW_HOURS['top-up']
  return PROTECTION_WINDOW_HOURS.items
}

// ─── §3 Withdrawal / payout fees (mirrored into withdrawal_methods rows) ────

// $50 — was $100, which sat above the whole sector (G2G/Eldorado/Gameflip
// are $10-50) and stranded small sellers' balances. Mirrored into the
// withdrawal_methods.min_withdrawal rows by migration.
export const PAYOUT_MIN_USD = 50
export const PAYOUT_FEES = {
  fiat: { pct: 1.5, fixed: 2 },
  crypto: { pct: 3, fixed: 10 },
} as const

export function payoutFee(amount: number, rail: keyof typeof PAYOUT_FEES): {
  fee: number
  net: number
} {
  const { pct, fixed } = PAYOUT_FEES[rail]
  const fee = round2(fixed + (amount * pct) / 100)
  return { fee, net: round2(amount - fee) }
}

// ─── §4 Extended warranty (BETA — flag OFF until caps are configured) ───────

export const WARRANTY_ENABLED = false
export const WARRANTY_ITEMS_LIFETIME_PCT = [
  { maxPrice: 250, pct: 5 },
  { maxPrice: 500, pct: 8 },
  { maxPrice: Infinity, pct: 10 },
] as const
export const WARRANTY_ACCOUNTS = {
  /** 14-day protection is included free on every account order. */
  includedDays: 14,
  oneMonthPct: 4,
  sixMonthPct: 8,
} as const

// ─── §5 / §6 Refund + chargeback financial rules ────────────────────────────

export const CASH_REFUND_DEDUCT_PROCESSING = true
/** ADJUSTABLE to actual PSP fee once contracts sign. */
export const CHARGEBACK_FEE_USD = 20

/** Store-credit refund: 100% of what the buyer paid, instantly. */
export function storeCreditRefundAmount(totalPaid: number): number {
  return round2(totalPaid)
}

/** Cash refund via support: amount paid minus processing fee actually incurred. */
export function cashRefundAmount(totalPaid: number, processingFeeIncurred: number): number {
  return round2(totalPaid - (CASH_REFUND_DEDUCT_PROCESSING ? processingFeeIncurred : 0))
}
