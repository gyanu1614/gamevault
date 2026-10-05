/**
 * SafeDrop Protection timing: the ONE module public copy reads its numbers from.
 *
 * Every legal document (Buyer Terms, SafeDrop Protection Terms, Refund &
 * Dispute Policy, Fees & Charges), the /safedrop page and its FAQ render these
 * values instead of typing them. They mirror what the money layer enforces:
 *
 *   PROTECTION_WINDOW_HOURS   order_completion_windows.auto_complete_hours
 *                             (seeded by migration 20260923025457; the hourly
 *                             auto-release run completes an unconfirmed,
 *                             undisputed order once delivered_at + window passes)
 *   DISPUTE_WINDOW_DAYS       platform_fee_settings.dispute_window_days
 *                             (order_dispute_open refuses a BUYER after
 *                             delivered_at + N days, before or after completion)
 *   COMPLETION_HOLD_HOURS     platform_fee_settings.completion_hold_hours
 *   WITHDRAWAL_MIN_ACCOUNT_AGE_DAYS / PAYOUT_DETAILS_FREEZE_HOURS
 *                             platform_fee_settings (withdrawal gate)
 *   CANCEL_REQUEST_MIN_DELIVERY_HOURS
 *                             src/lib/orders/cancel-request-eligibility.ts
 *
 * protection-windows.test.ts parses the migration so these cannot drift from
 * the seeded defaults; fee-legal-withdrawal-parity.guard.integration.test.ts
 * checks the live rows. The DB rows are admin-editable: an admin change must
 * be mirrored here (and the integration guard fails until it is).
 *
 * The dispute-process timings (seller response, evidence, decision) are
 * policy promises with no DB column; they live here so every surface states
 * the same number.
 */

import { CANCEL_REQUEST_MIN_DELIVERY_HOURS } from '../orders/cancel-request-eligibility'

export { CANCEL_REQUEST_MIN_DELIVERY_HOURS }

/** game_categories.type values (the CHECK on order_completion_windows). */
export type ProtectionCategoryType = 'currency' | 'items' | 'account' | 'top_up' | 'gift_card' | 'service'

/** Hours after delivery before an unconfirmed, undisputed Order completes automatically. */
export const PROTECTION_WINDOW_HOURS: Record<ProtectionCategoryType, number> = {
  currency: 24,
  items: 72,
  account: 120,
  top_up: 24,
  gift_card: 24,
  service: 72,
}

/** Days from delivery in which a Buyer may open a dispute, completed Order or not. */
export const DISPUTE_WINDOW_DAYS = 7
/** Hours a Buyer-confirmed sale waits before the Seller can withdraw it (auto-completed sales: none). */
export const COMPLETION_HOLD_HOURS = 24
/** Days after seller approval before the first withdrawal. */
export const WITHDRAWAL_MIN_ACCOUNT_AGE_DAYS = 30
/** Hours withdrawals pause after payout details change. */
export const PAYOUT_DETAILS_FREEZE_HOURS = 48

/** Dispute process (policy): Seller's chance to fix it in the Order chat. */
export const SELLER_RESPONSE_HOURS = 12
/** Dispute process (policy): time each side has to submit evidence. */
export const DISPUTE_EVIDENCE_HOURS = 24
/** Dispute process (policy): normal time for the Resolution Team's decision. */
export const DISPUTE_DECISION_DAYS = 3

/**
 * "1 day" / "3 days" / "36 hours". The exact form the legal parity guard
 * expects, so do not change it without changing the guard.
 */
export function hoursAsDays(hours: number): string {
  if (hours % 24 !== 0) return `${hours} hours`
  const d = hours / 24
  return `${d} day${d === 1 ? '' : 's'}`
}

/** Title Case for UI labels: "1 Day", "3 Days", "36 Hours". */
export function hoursAsDaysTitle(hours: number): string {
  return hoursAsDays(hours).replace(/\b(day|days|hours)\b/, (w) => w[0].toUpperCase() + w.slice(1))
}

/** "7 days" */
export const DISPUTE_WINDOW_LABEL = `${DISPUTE_WINDOW_DAYS} days`

const W = PROTECTION_WINDOW_HOURS

/**
 * One plain-English sentence listing every window, for FAQs. Top-ups and gift
 * cards share a row everywhere; the unit test fails if their windows diverge.
 */
export function protectionWindowSummary(): string {
  return (
    `Each category has its own protection window, counted from delivery: ` +
    `${hoursAsDays(W.currency)} for in-game currency, top-ups and gift cards, ` +
    `${hoursAsDays(W.items)} for items, ` +
    `${hoursAsDays(W.service)} after completion for boosting and coaching, ` +
    `and ${hoursAsDays(W.account)} for game accounts.`
  )
}
