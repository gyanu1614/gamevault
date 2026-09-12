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
//
// Fee grid (approved 8 Sep 2026): DB-driven via category_fee_config /
// game_fee_overrides / seller_tier_config.fee_multiplier, edited in the admin
// panel. The DEFAULT_FEE_CONFIG below mirrors the seeded DB values and is the
// fallback when the DB is unreachable (and the sync default for previews).
// Effective % = (game override ?? category base)
//               × rank multiplier      (categories with rankDiscount only)
//               − founding discount    (pts, floored at 0)
// …all replaced by an unexpired per-seller admin override when present.
// The rate is snapshotted on the order at purchase (orders.platform_fee_rate);
// later config/rank changes never touch existing orders.

export type FeeCategory = OfferType // 'currency' | 'items' | 'accounts' | 'top-up'

export interface CategoryFeeDef {
  basePct: number
  /** Whether the seller-rank fee multiplier applies (top-up: false). */
  rankDiscount: boolean
}

export interface FeeConfigSnapshot {
  categories: Record<FeeCategory, CategoryFeeDef>
  /** `${gameSlug}:${category}` → pct, active overrides only. */
  gameOverrides: Record<string, number>
  /** seller_tier → fee multiplier (bronze 1.00 … legendary 0.80). */
  multipliers: Record<string, number>
}

/** Mirrors the migration-seeded DB rows — keep the two in sync. */
export const DEFAULT_FEE_CONFIG: FeeConfigSnapshot = {
  categories: {
    currency: { basePct: 10, rankDiscount: true },
    items: { basePct: 10, rankDiscount: true },
    accounts: { basePct: 15, rankDiscount: true },
    'top-up': { basePct: 5, rankDiscount: false },
  },
  gameOverrides: {
    'gta-v:accounts': 20,
    'gta-6:accounts': 20,
    'gtavi:accounts': 20,
  },
  multipliers: { bronze: 1.0, silver: 0.95, gold: 0.9, diamond: 0.85, legendary: 0.8 },
}

/** Promo/launch games at 0% currency commission — default EMPTY (spec §1). */
export const PROMO_ZERO_FEE_GAMES: string[] = []

/** Kept for protection-window mapping only (fees now use game_fee_overrides). */
export type AccountRiskBand = 'low' | 'mid' | 'high'

/**
 * Founding-seller commission discount, in PERCENTAGE POINTS off the seller's
 * per-category rate (floored at 0). This is what makes the "founding seller
 * locks a reduced rate for life" perk real: a founding seller pays
 * `max(0, categoryPct − FOUNDING_DISCOUNT_PTS)` on every category, forever
 * (see profiles.founding_seller, granted by admin). It applies AFTER the
 * promo/roblox-economy/account-risk category rate is resolved, so the discount
 * follows each category proportionally rather than flattening them:
 *   Roblox economy 10 → 8,  items/boosting 7 → 5,  standard currency 5 → 3,
 *   mid-risk accounts 15 → 13,  promo 0 → 0 (already floored).
 * ADJUSTABLE — one place to retune the founding programme.
 */
export const FOUNDING_DISCOUNT_PTS = 2

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
  /**
   * When true, apply the founding-seller discount (FOUNDING_DISCOUNT_PTS off
   * the resolved category rate, floored at 0). Sourced from
   * profiles.founding_seller by the caller (checkout/orders look the seller up
   * before computing commission). Omitted/false = today’s behaviour exactly.
   */
  isFounding?: boolean
  /** Seller rank (profiles.seller_tier) — applies the rank fee multiplier. */
  sellerTier?: string | null
  /**
   * Unexpired per-seller admin override % (profiles.fee_override_pct) —
   * REPLACES every other fee rule. Callers should pass it through
   * sellerFeeFields() so expiry is enforced in one place.
   */
  feeOverridePct?: number | null
}

/**
 * Extract the fee-relevant fields off a seller profile row, enforcing the
 * override expiry. Works with the loose profile shapes used across the app.
 */
export function sellerFeeFields(
  seller:
    | {
        seller_tier?: string | null
        founding_seller?: boolean | null
        fee_override_pct?: number | string | null
        fee_override_expires_at?: string | null
      }
    | null
    | undefined,
): Pick<CommissionInput, 'sellerTier' | 'isFounding' | 'feeOverridePct'> {
  const rawOverride = seller?.fee_override_pct
  const overridePct = rawOverride == null ? null : Number(rawOverride)
  const expiry = seller?.fee_override_expires_at
  const overrideActive =
    overridePct != null &&
    Number.isFinite(overridePct) &&
    (!expiry || new Date(expiry).getTime() > Date.now())
  return {
    sellerTier: seller?.seller_tier ?? null,
    isFounding: seller?.founding_seller === true,
    feeOverridePct: overrideActive ? overridePct : null,
  }
}

/**
 * Category commission % from a config snapshot, BEFORE rank/founding
 * adjustments: game override wins over the category base; promo games are 0%.
 */
function categoryCommissionPct(input: CommissionInput, cfg: FeeConfigSnapshot): number {
  const type: OfferType = classifyOfferType(
    input.categoryMetaType ?? undefined,
    input.categorySlug ?? undefined,
  )
  const game = (input.gameSlug || '').toLowerCase()
  if (type === 'currency' && PROMO_ZERO_FEE_GAMES.includes(game)) return 0
  const override = cfg.gameOverrides[`${game}:${type}`]
  return override ?? cfg.categories[type].basePct
}

/** Whether the rank multiplier applies to this listing's category. */
function rankDiscountApplies(input: CommissionInput, cfg: FeeConfigSnapshot): boolean {
  const type: OfferType = classifyOfferType(
    input.categoryMetaType ?? undefined,
    input.categorySlug ?? undefined,
  )
  return cfg.categories[type].rankDiscount
}

/**
 * Effective commission % for a listing:
 * per-seller override, else (game override ?? category base) × rank
 * multiplier (where the category allows it) − founding discount, floored at 0.
 * Pass the DB-loaded snapshot (loadFeeConfig) server-side; the default
 * snapshot keeps sync preview callers working.
 */
export function commissionPct(
  input: CommissionInput,
  cfg: FeeConfigSnapshot = DEFAULT_FEE_CONFIG,
): number {
  if (input.feeOverridePct != null) return round2(input.feeOverridePct)
  let pct = categoryCommissionPct(input, cfg)
  if (input.sellerTier && rankDiscountApplies(input, cfg)) {
    pct *= cfg.multipliers[input.sellerTier] ?? 1
  }
  if (input.isFounding) pct = Math.max(0, pct - FOUNDING_DISCOUNT_PTS)
  return round2(pct)
}

/** Commission amount on the item price (never on the buyer fee). */
export function commissionAmount(
  itemPrice: number,
  input: CommissionInput,
  cfg: FeeConfigSnapshot = DEFAULT_FEE_CONFIG,
): number {
  return round2((itemPrice * commissionPct(input, cfg)) / 100)
}

/** “You’ll receive $X after Y% fee” — net proceeds = price − commission. */
export function netProceeds(
  itemPrice: number,
  input: CommissionInput,
  cfg: FeeConfigSnapshot = DEFAULT_FEE_CONFIG,
): number {
  return round2(itemPrice - commissionAmount(itemPrice, input, cfg))
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
