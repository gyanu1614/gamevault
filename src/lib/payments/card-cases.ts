/**
 * CARD_CASE — a FULL card refund made outside DropMarket, or a card dispute
 * opened / closed, booked by its ONE SQL seam (migration 20261028143542):
 *
 *   refund_external  card_refund_external_book: never a store credit on top
 *                    (no double pay); refunded before completion, frozen for
 *                    an admin decision after.
 *   dispute_opened   card_dispute_open: the order (and a released seller
 *                    share) is held and the buyer blocked.
 *   dispute_closed   card_dispute_close: won → released; lost → the seller pays
 *                    without delivery proof, else DropMarket absorbs.
 *
 * Every seam is idempotent on the provider ref, writes its own admin alert and
 * runs in one transaction; an error throws so the webhook is retried.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import type { CanonicalEvent } from '@/lib/payments/types'

type CardCase = Extract<CanonicalEvent, { type: 'CARD_CASE' }>

function call(event: CardCase): { fn: string; args: Record<string, unknown> } {
  const amount = Number(event.amount.amountMinor)
  switch (event.kind) {
    case 'refund_external':
      return {
        fn: 'card_refund_external_book',
        args: {
          p_order_id: event.orderId,
          p_ref: event.providerRef,
          p_session: event.sessionRef ?? null,
          p_amount_minor: amount,
          p_currency: event.amount.currency,
        },
      }
    case 'dispute_opened':
      return {
        fn: 'card_dispute_open',
        args: {
          p_order_id: event.orderId,
          p_ref: event.providerRef,
          p_session: event.sessionRef ?? null,
          p_amount_minor: amount,
          p_currency: event.amount.currency,
          p_reason: event.reason ?? null,
          p_due_by: event.dueBy ?? null,
        },
      }
    case 'dispute_closed':
      if (!event.outcome) throw new Error(`card case ${event.providerRef}: dispute_closed without an outcome`)
      return { fn: 'card_dispute_close', args: { p_ref: event.providerRef, p_outcome: event.outcome } }
  }
}

export async function recordCardCase(event: CardCase): Promise<Record<string, unknown>> {
  const { fn, args } = call(event)
  const { data, error } = await (createServiceRoleClient().rpc as any)(fn, args)
  if (error) throw new Error(`${fn} failed for ${event.providerRef}: ${error.message}`)
  return (data ?? {}) as Record<string, unknown>
}
