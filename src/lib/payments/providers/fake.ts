/**
 * Fake payment provider — in-memory adapter implementing PaymentProvider, so
 * the seam + webhook spine + dispatch are fully testable without a network or
 * real provider (spec Phase 3). It mirrors the real verification contract:
 * parseWebhook rejects a bad signature and maps a synthetic payload to
 * canonical events.
 *
 * Webhook payload shape (JSON string in rawBody):
 *   { "chargeId": "...", "orderId": "...", "status": "paid"|"pending"|"failed"|"refunded",
 *     "amountMinor": "10000", "currency": "EUR" }
 * Signature: header "x-fake-signature" must equal FAKE_WEBHOOK_SECRET (default
 * "fake-secret"); anything else throws (→ spine returns 400).
 */

import type {
  PaymentProvider,
  CreateChargeInput,
  CreateChargeResult,
  ParsedWebhook,
  CanonicalEvent,
} from '@/lib/payments/types'
import { money } from '@/lib/money'

const SECRET = process.env.FAKE_WEBHOOK_SECRET ?? 'fake-secret'

export const fakeProvider: PaymentProvider = {
  name: 'fake',
  capabilities: {
    isCrypto: true,
    supportsEscrowHold: false,
    supportsSplitPayout: false,
    supportsRefund: true,
    chargebackRisk: false,
  },

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const id = `fake_${input.orderId}`
    return {
      providerChargeId: id,
      checkoutUrl: `https://fake.test/checkout/${id}`,
      rawStatus: 'pending',
    }
  },

  async getCharge(providerChargeId: string): Promise<{ rawStatus: string }> {
    // In-memory fake has no persistent store; tests drive status via the webhook
    // body, and the spine trusts parseWebhook's mapping. Return 'paid' as the
    // authoritative default (a real adapter re-fetches the provider here).
    return { rawStatus: 'paid' }
  },

  async parseWebhook(headers, rawBody): Promise<ParsedWebhook> {
    // 1. Verify signature (timing-safe-ish; this is a test double).
    const sig = headers['x-fake-signature'] ?? headers['X-Fake-Signature']
    if (sig !== SECRET) {
      throw new Error('fake: bad signature')
    }

    // 2. Parse body.
    const body = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
    const { chargeId, orderId, status } = body
    const amt = () => money(BigInt(body.amountMinor ?? '0'), body.currency ?? 'EUR')

    // 3. Map to canonical events. providerEventId includes status so distinct
    //    status changes dedupe independently but a true replay is caught.
    const providerEventId = `${chargeId}:${status}`
    const events: CanonicalEvent[] = []
    switch (status) {
      case 'pending':
        events.push({ type: 'CHARGE_PENDING', orderId, providerChargeId: chargeId })
        break
      case 'paid':
        events.push({ type: 'CHARGE_CONFIRMED', orderId, providerChargeId: chargeId, settled: amt() })
        break
      case 'failed':
        events.push({ type: 'CHARGE_FAILED', orderId, providerChargeId: chargeId, reason: 'fake-failed' })
        break
      case 'refunded':
        events.push({ type: 'REFUND_COMPLETED', orderId, refundId: chargeId, amount: amt() })
        break
      // unknown status → no events (logged no-op upstream)
    }
    return { providerEventId, events }
  },

  async refund(providerChargeId, amount, _idempotencyKey) {
    return { refundId: `refund_${providerChargeId}` }
  },
}
