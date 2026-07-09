/**
 * Payment provider abstraction — the seam that makes the money core
 * provider-agnostic (spec §2). The escrow state machine and ledger react ONLY
 * to the canonical events below; adapters (CoinGate, Tazapay, the fake test
 * provider) translate their provider's webhooks into these. Adding/swapping a
 * provider changes only src/lib/payments/providers/* — never the core.
 *
 * Money is always integer minor units (`Money` from @/lib/money). Adapters
 * convert their provider's decimal strings at the adapter boundary.
 */

import type { Money } from '@/lib/money'

// ─── Canonical events (the common vocabulary) ─────────────────────
// Providers normalize their raw webhooks into THESE. The dispatch layer maps
// each to a SafeDrop OrderEvent.

export type CanonicalEvent =
  | { type: 'CHARGE_PENDING'; orderId: string; providerChargeId: string }
  | { type: 'CHARGE_CONFIRMED'; orderId: string; providerChargeId: string; settled: Money }
  | { type: 'CHARGE_FAILED'; orderId: string; providerChargeId: string; reason: string }
  | { type: 'REFUND_COMPLETED'; orderId: string; refundId: string; amount: Money }
  | { type: 'PAYOUT_COMPLETED'; payoutId: string; amount: Money }
  | { type: 'PAYOUT_FAILED'; payoutId: string; reason: string }
  | { type: 'CHARGEBACK_OPENED'; orderId: string; providerChargeId: string; amount: Money }
  | { type: 'CHARGEBACK_RESOLVED'; orderId: string; providerChargeId: string; won: boolean }

export type CanonicalEventType = CanonicalEvent['type']

// ─── Provider capabilities ────────────────────────────────────────
// Lets the core branch on what a provider can do (e.g. crypto has no
// chargeback risk → reserve engine stays dormant) without leaking provider
// specifics upward.

export interface ProviderCapabilities {
  isCrypto: boolean
  supportsEscrowHold: boolean // provider natively holds funds until release
  supportsSplitPayout: boolean // provider pays sellers directly (POBO)
  supportsRefund: boolean
  chargebackRisk: boolean // true for cards, false for crypto
}

// ─── Charge creation ──────────────────────────────────────────────

export interface CreateChargeInput {
  orderId: string
  amount: Money
  buyerRef?: string
  /** Where the buyer lands on SUCCESS (e.g. the order page). */
  returnUrl: string
  /** Where the buyer lands on CANCEL/abandon (e.g. back to checkout to retry).
   *  Falls back to returnUrl if omitted. */
  cancelUrl?: string
  metadata?: Record<string, string>
}

export interface CreateChargeResult {
  providerChargeId: string
  checkoutUrl: string // hosted checkout / payment page to redirect the buyer to
  rawStatus: string
}

// ─── Webhook parsing result ───────────────────────────────────────
// parseWebhook verifies the signature/source, then maps the raw payload to
// 0..n canonical events. It returns a STABLE providerEventId used for the
// dedupe key. It MUST be side-effect-free beyond verification + an
// authoritative re-fetch (never trust the webhook body's status alone).

export interface ParsedWebhook {
  providerEventId: string // stable id for dedupe, e.g. "<chargeId>:<status>"
  events: CanonicalEvent[]
}

// ─── The interface every provider implements ──────────────────────

export interface PaymentProvider {
  readonly name: string
  readonly capabilities: ProviderCapabilities

  /** Create a hosted charge/checkout for an order; returns the redirect URL. */
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>

  /** Retrieve authoritative charge state from the provider (the source of truth). */
  getCharge(providerChargeId: string): Promise<{ rawStatus: string }>

  /**
   * Verify the request's signature/source and map it to canonical events.
   * Throws on a failed/forged verification (the spine returns 4xx).
   * `headers` and `rawBody` are passed straight from the HTTP handler — the
   * raw body must be preserved (signatures are computed over raw bytes).
   */
  parseWebhook(headers: Record<string, string>, rawBody: Buffer | string): Promise<ParsedWebhook>

  /** Refund a charge (outbound). Idempotency handled by the caller's dedupe. */
  refund?(providerChargeId: string, amount: Money, idempotencyKey: string): Promise<{ refundId: string }>

  /** Pay a seller out — only if capabilities.supportsSplitPayout. */
  payout?(sellerPayoutRef: string, amount: Money, idempotencyKey: string): Promise<{ payoutId: string }>

  /** Provider balance(s), for reconciliation. */
  getBalance?(): Promise<Money[]>
}
