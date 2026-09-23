/**
 * Stored shape of canonical events on webhook_events.events (round B Part 4,
 * PAY-010). The router stores the VERIFIED events at claim time so the
 * reconciler can re-run a row whose first run never reached
 * webhook_event_mark — through the same dispatch, without the raw body or
 * the signature (both were already checked; the provider re-fetch already
 * happened). Money is bigint minor units, which JSON cannot carry, so the
 * stored form is explicit and rejects anything it does not recognise.
 */

import type { CanonicalEvent } from '@/lib/payments/types'
import { money, type Money } from '@/lib/money'

export interface StoredMoney {
  amountMinor: string
  currency: string
}

export type StoredCanonicalEvent = Record<string, unknown> & { type: CanonicalEvent['type'] }

const TYPES = new Set<CanonicalEvent['type']>([
  'CHARGE_PENDING', 'CHARGE_CONFIRMED', 'CHARGE_FAILED', 'REFUND_COMPLETED',
  'PAYOUT_COMPLETED', 'PAYOUT_FAILED', 'CHARGEBACK_OPENED', 'CHARGEBACK_RESOLVED',
])
const MONEY_FIELDS = ['settled', 'paid', 'amount'] as const

function packMoney(m: Money): StoredMoney {
  return { amountMinor: m.amountMinor.toString(), currency: m.currency }
}
function unpackMoney(v: unknown, field: string): Money {
  const o = v as Partial<StoredMoney> | null
  if (!o || typeof o.amountMinor !== 'string' || typeof o.currency !== 'string') {
    throw new Error(`webhook events: field ${field} is not stored money`)
  }
  return money(BigInt(o.amountMinor), o.currency)
}

export function serializeCanonicalEvents(events: CanonicalEvent[]): StoredCanonicalEvent[] {
  return events.map((e) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(e)) {
      if (v === undefined) continue
      out[k] = (MONEY_FIELDS as readonly string[]).includes(k) ? packMoney(v as Money) : v
    }
    return out as StoredCanonicalEvent
  })
}

export function deserializeCanonicalEvents(raw: unknown): CanonicalEvent[] {
  if (!Array.isArray(raw)) throw new Error('webhook events: stored payload is not an events list')
  return raw.map((item, i) => {
    const o = item as Record<string, unknown> | null
    if (!o || typeof o.type !== 'string' || !TYPES.has(o.type as CanonicalEvent['type'])) {
      throw new Error(`webhook events: item ${i} has unknown type ${String(o?.type)}`)
    }
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o)) {
      out[k] = (MONEY_FIELDS as readonly string[]).includes(k) ? unpackMoney(v, k) : v
    }
    return out as unknown as CanonicalEvent
  })
}
