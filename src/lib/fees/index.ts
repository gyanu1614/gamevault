/**
 * fees — single source of truth for ALL platform fees.
 *
 * Implements DropMarket_Fee_Implementation_Spec (12 Jul 2026) exactly.
 * Marketplace fee, protection windows, payout and refund rules live HERE and
 * are imported everywhere — no scattered literals (spec §7). The SELLER
 * COMMISSION does not: it is database data behind resolve_seller_fee (see
 * ./resolver.ts). Neither does the buyer PROCESSING fee (checkout B3): it is
 * database data per payment method behind buyer_fee_quote. Values marked ADJUSTABLE are plain consts so ops can
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
//
// NOT HERE (buyer-service-fee, 2026-09-30). The whole buyer fee is quoted by
// ONE SQL function, buyer_fee_quote (lib/payments/eligibility reaches it):
//   marketplace = max($0.30, 2% × subtotal)   (platform_fee_settings)
//   processing  = the method's provider cost on what the provider is charged
//   $1.00 minimum order total; zero for store credit.
// order_create_pending snapshots both parts (orders.platform_fee +
// orders.payment_processing_fee). No TypeScript computes any of it; the page
// shows the sum as ONE line under this label, never a percentage.
export const SERVICE_FEE_LABEL = 'Service fee'

// ─── §1 Seller commission ────────────────────────────────────────────────────
// NOT HERE. The seller commission rate is DATA (fee_rules, seller_tier_config
// .discount_pts, platform_fee_settings) resolved by ONE SQL function,
// resolve_seller_fee, through src/lib/fees/resolver.ts — checkout stamps it
// on the order, the sell wizard previews it, /sell/fees publishes it. No
// TypeScript computes a commission percentage (fee-engine.md §8.4); the
// constants that used to live here (COMMISSION_PCT, ROBLOX_ECONOMY_GAMES,
// ACCOUNT_RISK_BANDS as a fee input, FOUNDING_DISCOUNT_PTS, commissionPct,
// commissionAmount, netProceeds) were deleted in fee engine PR 5.

// ─── §1 Protection windows / payout holds ───────────────────────────────────
// Deleted in fee engine PR 7: the SafeDrop Protection window per category is a
// row in `order_completion_windows` (admin-editable) and is applied by the
// `order_mark_delivered` RPC. Nothing in TypeScript computes a window.

export type { AccountRiskBand }

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
//
// Refund amounts are decided in SQL (order_refund_buyer_credit, reached
// through order_refund_to_wallet / order_cancel_return_wallet with a fault):
// buyer fault = item price, fees kept; seller / platform fault = full. Nothing
// in TypeScript computes a refund amount.

/** ADJUSTABLE to actual PSP fee once contracts sign. */
export const CHARGEBACK_FEE_USD = 20
