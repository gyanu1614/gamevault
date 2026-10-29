/**
 * Stripe → canonical events. Pure: the adapter hands in objects it RE-FETCHED
 * from Stripe with our secret key, never the webhook body's copy.
 *
 *   Checkout Session (provider_charge_id = cs_…)
 *     complete + paid, amount/currency = what we asked → CHARGE_CONFIRMED
 *     complete + paid, anything else differs            → CHARGE_PENDING (admin path)
 *     complete + unpaid (async method in flight)         → CHARGE_PENDING
 *     complete + unpaid after async_payment_failed       → CHARGE_FAILED
 *     expired                                            → CHARGE_FAILED
 *   Charge refunded / disputes → ./card-case-map.ts (CARD_CASE)
 *
 * The amount we asked for is stamped on the session's metadata at create
 * (amount_minor + currency). Metadata is written server-side only, so a
 * session that does not carry the stamp is not one we can confirm.
 *
 * Dedupe ids: `<session>:<outcome>` (the re-fetched outcome, so a replay of
 * any event that reaches the same outcome is a no-op).
 */

import type { CanonicalEvent } from '@/lib/payments/types'
import { money } from '@/lib/money'

/** The fields of a Checkout Session the mapping reads. */
export interface StripeSessionView {
  id: string
  status: 'open' | 'complete' | 'expired' | null
  payment_status: 'paid' | 'unpaid' | 'no_payment_required'
  amount_total: number | null
  currency: string | null
  client_reference_id: string | null
  metadata: Record<string, string> | null
  payment_intent: string | { id: string } | null
}

/** Our vocabulary for a session — the same words the Payssion return route
 *  reads (lib/payments/return-destination.ts): completed / pending / expired.
 *  `processing` = the session completed but the money has not landed. */
export type StripeSessionState = 'completed' | 'processing' | 'pending' | 'expired'

export function stripeSessionState(s: StripeSessionView): StripeSessionState {
  if (s.status === 'expired') return 'expired'
  if (s.status === 'complete') return s.payment_status === 'paid' ? 'completed' : 'processing'
  return 'pending'
}

/** Our order UUID, set at create as client_reference_id AND metadata.order_id.
 *  Both must be present and agree, or the session is not one of ours. */
export function stripeSessionOrderId(s: StripeSessionView): string {
  const ref = s.client_reference_id
  const meta = s.metadata?.order_id
  if (!ref || !meta) throw new Error(`stripe: session ${s.id} carries no order id — not ours`)
  if (ref !== meta) throw new Error(`stripe: session ${s.id} order id mismatch (client_reference_id vs metadata)`)
  return ref
}

/** True when the session charged exactly the amount and currency we stamped on it. */
function chargedWhatWeAsked(s: StripeSessionView): boolean {
  const askedMinor = s.metadata?.amount_minor
  const askedCurrency = s.metadata?.currency
  if (!askedMinor || !/^\d+$/.test(askedMinor) || !askedCurrency) return false
  if (s.amount_total == null || !s.currency) return false
  return BigInt(s.amount_total) === BigInt(askedMinor) && s.currency.toUpperCase() === askedCurrency.toUpperCase()
}

export interface SessionEventOpts {
  /** The event was checkout.session.async_payment_failed. */
  asyncFailed?: boolean
}

function outcome(s: StripeSessionView, opts?: SessionEventOpts): 'completed' | 'pending' | 'expired' | 'failed' {
  const state = stripeSessionState(s)
  if (state === 'completed' || state === 'expired') return state
  if (state === 'processing' && opts?.asyncFailed) return 'failed'
  return 'pending'
}

export function stripeSessionEventId(s: StripeSessionView, opts?: SessionEventOpts): string {
  return `${s.id}:${outcome(s, opts)}`
}

export function stripeSessionToCanonical(s: StripeSessionView, opts?: SessionEventOpts): CanonicalEvent[] {
  const orderId = stripeSessionOrderId(s)
  const providerChargeId = s.id
  switch (outcome(s, opts)) {
    case 'completed': {
      if (!chargedWhatWeAsked(s)) {
        console.warn(
          `[Stripe] session ${s.id} paid ${s.amount_total} ${s.currency} but we asked ${s.metadata?.amount_minor} ${s.metadata?.currency} — not confirming`
        )
        return [{ type: 'CHARGE_PENDING', orderId, providerChargeId }]
      }
      const charged = money(BigInt(s.amount_total as number), (s.currency as string).toUpperCase())
      return [{ type: 'CHARGE_CONFIRMED', orderId, providerChargeId, settled: charged, paid: charged }]
    }
    case 'expired':
      return [{ type: 'CHARGE_FAILED', orderId, providerChargeId, reason: 'expired' }]
    case 'failed':
      return [{ type: 'CHARGE_FAILED', orderId, providerChargeId, reason: 'async_payment_failed' }]
    default:
      return [{ type: 'CHARGE_PENDING', orderId, providerChargeId }]
  }
}
