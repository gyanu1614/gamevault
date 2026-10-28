/**
 * Stripe adapter — implements PaymentProvider with hosted Checkout.
 * One-time card payment (Visa / Mastercard; Apple Pay and Google Pay appear
 * on Stripe's page when the buyer's device has them). DropMarket is the
 * merchant; no Connect.
 *
 * Verification chain in parseWebhook (spec §5 — do not shortcut):
 *   1. Stripe-Signature verified over the RAW body (Stripe's own check,
 *      5-minute timestamp tolerance). A test-mode event is refused in production.
 *   2. RE-FETCH the session / charge / dispute from Stripe with our secret key
 *      and trust THAT — the body only supplies the object id.
 *   3. The order id is the one WE stamped at create (client_reference_id +
 *      metadata on the session, metadata on the PaymentIntent).
 * Refunds and disputes are recorded for admins (PAYMENT_NOTICE) — they
 * never move money on their own.
 */

import Stripe from 'stripe'

import type {
  PaymentProvider,
  CreateChargeInput,
  CreateChargeResult,
  ParsedWebhook,
  ProviderCapabilities,
  VoidChargeResult,
} from '@/lib/payments/types'
import type { Money } from '@/lib/money'
import { displayOrderRef } from '@/lib/orders/order-number'
import { stripeClient } from './client'
import { assertStripeConfigured, isProductionDeploy, stripeWebhookSecret } from './env'
import {
  stripeDisputeNotice,
  stripeRefundNotice,
  stripeSessionEventId,
  stripeSessionOrderId,
  stripeSessionState,
  stripeSessionToCanonical,
  type StripeChargeView,
  type StripeDisputeView,
  type StripeSessionView,
} from './status-map'

/** The slice of the Stripe client the adapter uses (tests pass a fake). */
export type StripeApi = Pick<Stripe, 'checkout' | 'charges' | 'disputes' | 'refunds'>

const CAPABILITIES: ProviderCapabilities = {
  isCrypto: false,
  supportsEscrowHold: false,
  supportsSplitPayout: false,
  supportsRefund: true,
  chargebackRisk: true, // card disputes
}

/** A Checkout Session lives this long (Stripe allows 30 min – 24 h); the
 *  same window as Payssion's instant methods. */
export const STRIPE_SESSION_MINUTES = 60

const SESSION_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
])

function header(headers: Record<string, string>, name: string): string | undefined {
  return headers[name] ?? headers[name.toLowerCase()]
}

function intentId(pi: StripeSessionView['payment_intent']): string | null {
  if (!pi) return null
  return typeof pi === 'string' ? pi : pi.id
}

export function makeStripeProvider(deps?: { api?: () => StripeApi }): PaymentProvider {
  // Lazy: the real client is built on the first call that needs it.
  const api = (): StripeApi => {
    if (deps?.api) {
      assertStripeConfigured()
      return deps.api()
    }
    return stripeClient()
  }

  async function session(id: string): Promise<StripeSessionView> {
    return (await api().checkout.sessions.retrieve(id)) as unknown as StripeSessionView
  }

  return {
    name: 'stripe',
    capabilities: CAPABILITIES,

    async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
      if (!input.idempotencyKey) throw new Error('stripe: createCharge needs an idempotency key (the attempt id)')
      const stripe = api()
      const currency = input.amount.currency.toUpperCase()
      const amountMinor = input.amount.amountMinor
      if (amountMinor <= 0n || amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`stripe: refusing charge amount ${amountMinor}`)
      }
      const ref = displayOrderRef(input.orderNumber, input.orderId)
      const stamp: Record<string, string> = {
        order_id: input.orderId,
        // What we asked for — the status map confirms only when the session
        // charged exactly this (metadata is written server-side only).
        amount_minor: amountMinor.toString(),
        currency,
        ...(input.orderNumber ? { order_number: input.orderNumber } : {}),
        ...(input.metadata?.listing_id ? { listing_id: input.metadata.listing_id } : {}),
      }
      const expiresAt = Math.floor(Date.now() / 1000) + STRIPE_SESSION_MINUTES * 60

      const created = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          allowed_payment_method_types: ['card'],
          // Charge in the order currency, always: our ledger is USD and the
          // confirm check compares against it.
          adaptive_pricing: { enabled: false },
          // DropMarket is the merchant (owner 2026-10-27). Managed Payments
          // (Stripe as merchant of record) is on by default on new accounts
          // and refuses allowed_payment_method_types — off for every session.
          managed_payments: { enabled: false },
          // 3D Secure on every card payment (owner 2026-10-27): a stolen-card
          // dispute then sits with the issuer. Accepts a small drop-off.
          payment_method_options: { card: { request_three_d_secure: 'any' } },
          submit_type: 'pay',
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: currency.toLowerCase(),
                unit_amount: Number(amountMinor),
                product_data: { name: `DropMarket order ${ref}` },
              },
            },
          ],
          client_reference_id: input.orderId,
          metadata: stamp,
          payment_intent_data: {
            description: `DropMarket order ${ref}`,
            metadata: { order_id: input.orderId, ...(input.orderNumber ? { order_number: input.orderNumber } : {}) },
          },
          success_url: input.returnUrl,
          cancel_url: input.cancelUrl ?? input.returnUrl,
          expires_at: expiresAt,
        },
        { idempotencyKey: `dm-checkout:${input.idempotencyKey}` }
      )
      if (!created.id || !created.url) throw new Error('stripe: create returned no session url')

      return {
        providerChargeId: created.id,
        checkoutUrl: created.url, // Stripe-hosted page (absolute)
        rawStatus: stripeSessionState(created as unknown as StripeSessionView),
        expiresAt: new Date((created.expires_at ?? expiresAt) * 1000).toISOString(),
      }
    },

    async getCharge(providerChargeId: string): Promise<{ rawStatus: string }> {
      return { rawStatus: stripeSessionState(await session(providerChargeId)) }
    },

    /**
     * Close an open session (POST /checkout/sessions/:id/expire). Never
     * voids money: a completed session is `paid` (its webhook decides). If
     * the expire is refused, the session's own state is the authority.
     */
    async voidCharge(providerChargeId: string): Promise<VoidChargeResult> {
      const before = stripeSessionState(await session(providerChargeId))
      if (before === 'completed' || before === 'processing') return { outcome: 'paid', rawStatus: before }
      if (before === 'expired') return { outcome: 'already_closed', rawStatus: before }
      try {
        const expired = await api().checkout.sessions.expire(providerChargeId)
        const state = stripeSessionState(expired as unknown as StripeSessionView)
        if (state === 'expired') return { outcome: 'voided', rawStatus: state }
      } catch (e) {
        console.warn(`[Stripe] expire of ${providerChargeId} refused — re-reading the session:`, (e as Error)?.message ?? e)
      }
      const after = stripeSessionState(await session(providerChargeId))
      if (after === 'completed' || after === 'processing') return { outcome: 'paid', rawStatus: after }
      if (after === 'expired') return { outcome: 'already_closed', rawStatus: after }
      throw new Error(`stripe: could not expire session ${providerChargeId} (still ${after})`)
    },

    async parseWebhook(headers: Record<string, string>, rawBody: Buffer | string): Promise<ParsedWebhook> {
      // STEP 1 — signature over the raw bytes.
      const secret = stripeWebhookSecret()
      if (!secret) throw new Error('[Stripe] STRIPE_WEBHOOK_SECRET is not set')
      const signature = header(headers, 'stripe-signature')
      if (!signature) throw new Error('stripe: missing Stripe-Signature header')
      const event = Stripe.webhooks.constructEvent(rawBody, signature, secret)
      if (isProductionDeploy() && !event.livemode) {
        throw new Error('stripe: test-mode event refused in production')
      }

      // STEP 2+3 — re-fetch the object; the body supplies only its id.
      const objectId = (event.data?.object as { id?: string } | undefined)?.id
      if (SESSION_EVENTS.has(event.type)) {
        if (!objectId) throw new Error(`stripe: ${event.type} without a session id`)
        const s = await session(objectId)
        stripeSessionOrderId(s) // not ours → throw (the router answers 400)
        const opts = { asyncFailed: event.type === 'checkout.session.async_payment_failed' }
        return { providerEventId: stripeSessionEventId(s, opts), events: stripeSessionToCanonical(s, opts) }
      }
      if (event.type === 'charge.refunded') {
        if (!objectId) throw new Error('stripe: charge.refunded without a charge id')
        const charge = await api().charges.retrieve(objectId, { expand: ['payment_intent'] })
        return stripeRefundNotice(charge as unknown as StripeChargeView)
      }
      if (event.type === 'charge.dispute.created') {
        if (!objectId) throw new Error('stripe: charge.dispute.created without a dispute id')
        const dispute = await api().disputes.retrieve(objectId, { expand: ['payment_intent'] })
        return stripeDisputeNotice(dispute as unknown as StripeDisputeView)
      }
      // Verified but not an event we act on: record it, change nothing.
      return { providerEventId: `${event.id}:ignored`, events: [] }
    },

    /** Refund To Card (refund_to_source outbox): money back to the card the
     *  session charged. The idempotency key is the outbox row's. */
    async refund(providerChargeId: string, amount: Money, idempotencyKey: string) {
      const s = await session(providerChargeId)
      const pi = intentId(s.payment_intent)
      if (!pi) throw new Error(`stripe: session ${providerChargeId} has no payment to refund`)
      if (!s.currency || s.currency.toUpperCase() !== amount.currency.toUpperCase()) {
        throw new Error(`stripe: refund currency ${amount.currency} does not match the charge (${s.currency})`)
      }
      const refund = await api().refunds.create(
        { payment_intent: pi, amount: Number(amount.amountMinor), metadata: { order_id: stripeSessionOrderId(s) } },
        { idempotencyKey: `dm-refund:${idempotencyKey}` }
      )
      return { refundId: refund.id }
    },
  }
}

export const stripeProvider: PaymentProvider = makeStripeProvider()
