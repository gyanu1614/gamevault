/**
 * Stripe charges and disputes → canonical events. Pure: the adapter hands in
 * objects it RE-FETCHED from Stripe with our secret key.
 *
 *   charge.refunded,        only refunds DropMarket did NOT send count (ours
 *   charge.refund.updated
 *                           carry `dm_refund` metadata — the outbox books them):
 *                             all outside, succeeded, the whole payment → CARD_CASE refund_external
 *                             partial / mixed / pending / unlisted      → PAYMENT_NOTICE (admin only)
 *   charge.dispute.created  → CARD_CASE dispute_opened (+ dispute_closed when the
 *                           re-fetch already shows the verdict)
 *   charge.dispute.closed   won / warning_closed → won, lost → lost; else nothing
 *
 * `sessionId` is the Checkout Session the charge belongs to (the adapter looks
 * it up by PaymentIntent); SQL books a case only against the paying session.
 *
 * Dedupe ids: `<charge>:refunded:<total refunded>:<succeeded total>`, `<dispute>:created`,
 * `<dispute>:closed:<status>`. The SQL seams are idempotent on the provider
 * ref as well.
 */

import type { CanonicalEvent } from '@/lib/payments/types'
import { money } from '@/lib/money'

/** The PaymentIntent as re-fetched with `expand: ['payment_intent']`. */
interface IntentView {
  id: string
  metadata: Record<string, string> | null
}

export interface StripeRefundView {
  id: string
  amount: number
  status: string | null
  metadata: Record<string, string> | null
}

/** A charge re-fetched with `expand: ['payment_intent', 'refunds']`. */
export interface StripeChargeView {
  id: string
  amount: number
  amount_refunded: number
  currency: string
  payment_intent: IntentView | string | null
  refunds: { data: StripeRefundView[]; has_more: boolean } | null
}

export interface StripeDisputeView {
  id: string
  amount: number
  currency: string
  reason: string | null
  status: string
  evidence_details: { due_by: number | null } | null
  payment_intent: IntentView | string | null
}

export interface StripeMapped {
  providerEventId: string
  events: CanonicalEvent[]
}

/** The metadata key DropMarket stamps on every refund it sends. */
export const DM_REFUND_KEY = 'dm_refund'

/** Our order id from the PaymentIntent metadata (payment_intent_data.metadata at create). */
function intentOrderId(pi: IntentView | string | null): string | null {
  if (!pi || typeof pi === 'string') return null
  return pi.metadata?.order_id || null
}

const DEAD_REFUND = new Set(['failed', 'canceled'])

export function stripeRefundEvents(charge: StripeChargeView, sessionId: string | null): StripeMapped {
  const live = (charge.refunds?.data ?? []).filter((r) => !DEAD_REFUND.has(r.status ?? ''))
  const outside = live.filter((r) => !r.metadata?.[DM_REFUND_KEY])
  // The succeeded total is part of the id: a pending refund that later succeeds
  // (charge.refund.updated) is a NEW event, not a replay of the pending one.
  const succeededMinor = live.filter((r) => r.status === 'succeeded').reduce((sum, r) => sum + r.amount, 0)
  const providerEventId = `${charge.id}:refunded:${charge.amount_refunded}:${succeededMinor}`
  const orderId = intentOrderId(charge.payment_intent)
  if (!orderId) return { providerEventId, events: [] }
  if (outside.length === 0 && !charge.refunds?.has_more) return { providerEventId, events: [] }

  const currency = charge.currency.toUpperCase()
  const outsideMinor = outside.reduce((s, r) => s + r.amount, 0)
  // Only money that has actually gone back counts: a pending refund may still fail.
  const settled = outside.every((r) => r.status === 'succeeded')
  const full = !charge.refunds?.has_more && settled && outside.length === live.length && outsideMinor === charge.amount
  if (full) {
    return {
      providerEventId,
      events: [
        {
          type: 'CARD_CASE',
          kind: 'refund_external',
          orderId,
          providerRef: `${charge.id}:refund`,
          sessionRef: sessionId,
          amount: money(BigInt(outsideMinor), currency),
        },
      ],
    }
  }
  return {
    providerEventId,
    events: [
      {
        type: 'PAYMENT_NOTICE',
        kind: 'refund',
        orderId,
        providerChargeId: charge.id,
        amount: money(BigInt(charge.amount_refunded), currency),
        detail: null,
      },
    ],
  }
}

function disputeOutcome(status: string): 'won' | 'lost' | null {
  if (status === 'lost') return 'lost'
  return status === 'won' || status === 'warning_closed' ? 'won' : null
}

export function stripeDisputeOpened(dispute: StripeDisputeView, sessionId: string | null): StripeMapped {
  const providerEventId = `${dispute.id}:created`
  const orderId = intentOrderId(dispute.payment_intent)
  if (!orderId) return { providerEventId, events: [] }
  const due = dispute.evidence_details?.due_by
  const amount = money(BigInt(dispute.amount), dispute.currency.toUpperCase())
  const events: CanonicalEvent[] = [
    {
      type: 'CARD_CASE',
      kind: 'dispute_opened',
      orderId,
      providerRef: dispute.id,
      sessionRef: sessionId,
      amount,
      reason: dispute.reason,
      dueBy: due ? new Date(due * 1000).toISOString() : null,
    },
  ]
  // Delivered late (a retry after the verdict): close it in the same run.
  const outcome = disputeOutcome(dispute.status)
  if (outcome) events.push({ type: 'CARD_CASE', kind: 'dispute_closed', orderId, providerRef: dispute.id, amount, outcome })
  return { providerEventId, events }
}

export function stripeDisputeClosed(dispute: StripeDisputeView): StripeMapped {
  const providerEventId = `${dispute.id}:closed:${dispute.status}`
  const orderId = intentOrderId(dispute.payment_intent)
  const outcome = disputeOutcome(dispute.status)
  if (!orderId || !outcome) return { providerEventId, events: [] }
  return {
    providerEventId,
    events: [
      {
        type: 'CARD_CASE',
        kind: 'dispute_closed',
        orderId,
        providerRef: dispute.id,
        amount: money(BigInt(dispute.amount), dispute.currency.toUpperCase()),
        outcome,
      },
    ],
  }
}
