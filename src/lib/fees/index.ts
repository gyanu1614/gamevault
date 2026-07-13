/**
 * fees — single source of truth for ALL platform fees.
 *
 * Implements DropMarket_Fee_Implementation_Spec (12 Jul 2026) exactly.
 * Every percentage/config value lives HERE and is imported everywhere —
 * no scattered literals (spec §7). Values marked ADJUSTABLE in the spec
 * are plain consts here so ops can change them in one place.
 *
 * Money rule: round to 2 dp, half-up. Fee components are rounded
 * individually and summed (so $100 → $5.00 + $2.00 = $7.00 total).
 */

import { classifyOfferType, type OfferType } from '@/lib/utils/offer-type'

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

// ─── §1 Seller commission (deducted from ITEM PRICE at completion) ──────────

export type AccountRiskBand = 'low' | 'mid' | 'high'

export const COMMISSION_PCT = {
  currencyStandard: 5,
  currencyRobloxEconomy: 10,
  currencyPromo: 0,
  items: 7,
  topUp: 5,
  boosting: 7,
  accounts: { low: 12, mid: 15, high: 20 } as Record<AccountRiskBand, number>,
} as const

/**
 * Roblox in-game economies (10% commission) — catalog config by game
 * slug; extend as games are added (spec names SAB / GAG / GAG2 “etc.”).
 */
export const ROBLOX_ECONOMY_GAMES: string[] = [
  'steal-a-brainrot',
  'grow-a-garden',
  'grow-a-garden-2',
]

/** Promo/launch games at 0% currency commission — default EMPTY (spec §1). */
export const PROMO_ZERO_FEE_GAMES: string[] = []

/**
 * Account risk bands by game slug (spec: each account listing maps to
 * exactly one band via catalog config). Unlisted games default to mid.
 */
export const ACCOUNT_RISK_BANDS: Record<string, AccountRiskBand> = {
  'gta-v': 'high',
  gtavi: 'high',
  'gta-6': 'high',
}
export const DEFAULT_ACCOUNT_RISK_BAND: AccountRiskBand = 'mid'

export function accountRiskBand(gameSlug: string | null | undefined): AccountRiskBand {
  return ACCOUNT_RISK_BANDS[(gameSlug || '').toLowerCase()] ?? DEFAULT_ACCOUNT_RISK_BAND
}

export interface CommissionInput {
  /** categories.metadata.type for the listing’s category. */
  categoryMetaType?: string | null
  categorySlug?: string | null
  gameSlug?: string | null
}

/** Commission % for a listing (spec §1 table). */
export function commissionPct(input: CommissionInput): number {
  const type: OfferType = classifyOfferType(
    input.categoryMetaType ?? undefined,
    input.categorySlug ?? undefined,
  )
  const game = (input.gameSlug || '').toLowerCase()
  switch (type) {
    case 'currency':
      if (PROMO_ZERO_FEE_GAMES.includes(game)) return COMMISSION_PCT.currencyPromo
      if (ROBLOX_ECONOMY_GAMES.includes(game)) return COMMISSION_PCT.currencyRobloxEconomy
      return COMMISSION_PCT.currencyStandard
    case 'top-up':
      return COMMISSION_PCT.topUp
    case 'accounts':
      return COMMISSION_PCT.accounts[accountRiskBand(game)]
    case 'items':
    default:
      // Boosting classifies as items today; both are 7% (spec §1).
      return COMMISSION_PCT.items
  }
}

/** Commission amount on the item price (never on the buyer fee). */
export function commissionAmount(itemPrice: number, input: CommissionInput): number {
  return round2((itemPrice * commissionPct(input)) / 100)
}

/** “You’ll receive $X after Y% fee” — net proceeds = price − commission. */
export function netProceeds(itemPrice: number, input: CommissionInput): number {
  return round2(itemPrice - commissionAmount(itemPrice, input))
}

// ─── §1 Protection windows / payout holds (hours) ───────────────────────────

export const PROTECTION_WINDOW_HOURS = {
  currency: 48,
  items: 72,
  'top-up': 48,
  /** After completion. */
  boosting: 72,
  accounts: { low: 5 * 24, mid: 7 * 24, high: 14 * 24 } as Record<AccountRiskBand, number>,
} as const

export function protectionWindowHours(input: CommissionInput): number {
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

export const PAYOUT_MIN_USD = 100
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
