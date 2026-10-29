/**
 * Stripe adapter: hosted Checkout create, signed webhook → authoritative
 * re-fetch → canonical events, void, refund. The Stripe API is a fake
 * object (no network); the signature check is Stripe's own code, fed headers
 * signed with Stripe's own test helper.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Stripe from 'stripe'

import { makeStripeProvider, type StripeApi } from './index'
import { money } from '@/lib/money'

const SECRET = 'whsec_unit_test_dummy'
const ORDER = '11111111-2222-3333-4444-555555555555'

function signed(event: Record<string, unknown>, secret = SECRET) {
  const payload = JSON.stringify(event)
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret })
  return { headers: { 'stripe-signature': header }, rawBody: payload }
}

function eventOf(type: string, object: Record<string, unknown>, over: Record<string, unknown> = {}) {
  return { id: `evt_${type}`, object: 'event', type, livemode: false, data: { object }, ...over }
}

const PAID_SESSION = {
  id: 'cs_test_1',
  status: 'complete',
  payment_status: 'paid',
  amount_total: 1234,
  currency: 'usd',
  client_reference_id: ORDER,
  metadata: { order_id: ORDER, amount_minor: '1234', currency: 'USD' },
  payment_intent: 'pi_1',
}

function fakeApi(over: { session?: Record<string, unknown> } = {}) {
  const session = { ...PAID_SESSION, ...over.session }
  const api = {
    checkout: {
      sessions: {
        create: vi.fn(async (params: any) => ({
          id: 'cs_test_new',
          url: 'https://checkout.stripe.com/c/pay/cs_test_new',
          status: 'open',
          payment_status: 'unpaid',
          expires_at: params.expires_at,
        })),
        retrieve: vi.fn(async () => session),
        list: vi.fn(async () => ({ data: [session] })),
        expire: vi.fn(async () => ({ ...session, status: 'expired', payment_status: 'unpaid' })),
      },
    },
    charges: {
      retrieve: vi.fn(async () => ({
        id: 'ch_1',
        amount: 1234,
        amount_refunded: 500,
        currency: 'usd',
        payment_intent: { id: 'pi_1', metadata: { order_id: ORDER } },
        refunds: { data: [{ id: 're_9', amount: 500, status: 'succeeded', metadata: {} }], has_more: false },
      })),
    },
    disputes: {
      retrieve: vi.fn(async () => ({
        id: 'dp_1',
        amount: 1234,
        currency: 'usd',
        reason: 'fraudulent',
        status: 'lost',
        charge: 'ch_1',
        evidence_details: { due_by: null },
        payment_intent: { id: 'pi_1', metadata: { order_id: ORDER } },
      })),
    },
    refunds: {
      create: vi.fn(async () => ({ id: 're_1', status: 'succeeded' })),
      retrieve: vi.fn(async () => ({ id: 're_9', charge: 'ch_1', status: 'succeeded' })),
    },
  }
  return api
}

function provider(api: ReturnType<typeof fakeApi>) {
  return makeStripeProvider({ api: () => api as unknown as StripeApi })
}

beforeEach(() => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_unit_dummy')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET)
  vi.stubEnv('VERCEL_ENV', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('stripe: importing the adapter never needs the keys', () => {
  it('the registry and the adapter load with no STRIPE_* env (PR #239: import-time client broke builds)', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    vi.resetModules()
    const mod = await import('./index')
    expect(mod.stripeProvider.name).toBe('stripe')
    const reg = await import('@/lib/payments/registry')
    expect(reg.registeredProviders()).toContain('stripe')
  })
})

describe('stripe: createCharge (hosted Checkout)', () => {
  const input = {
    orderId: ORDER,
    orderNumber: 'DM-ABCD-EFGH',
    amount: money(1234n, 'USD'),
    returnUrl: `http://localhost:3000/checkout/return/${ORDER}`,
    cancelUrl: `http://localhost:3000/checkout/return/${ORDER}`,
    idempotencyKey: 'attempt-uuid-1',
  }

  it('creates a one-time card session bound to the order, with an idempotency key', async () => {
    const api = fakeApi()
    const res = await provider(api).createCharge(input)
    expect(res).toMatchObject({ providerChargeId: 'cs_test_new', checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_new', rawStatus: 'pending' })
    const [params, opts] = api.checkout.sessions.create.mock.calls[0] as unknown as [any, any]
    expect(params.mode).toBe('payment')
    expect(params.allowed_payment_method_types).toEqual(['card'])
    expect(params.adaptive_pricing).toEqual({ enabled: false })
    // DropMarket is the merchant: Stripe's Managed Payments (on by default on
    // new accounts, and it refuses allowed_payment_method_types) stays off.
    expect(params.managed_payments).toEqual({ enabled: false })
    // 3D Secure on every card payment (owner 2026-10-27): stolen-card
    // disputes then sit with the card issuer, not with DropMarket.
    expect(params.payment_method_options).toEqual({ card: { request_three_d_secure: 'any' } })
    expect(params.client_reference_id).toBe(ORDER)
    expect(params.metadata).toMatchObject({ order_id: ORDER, amount_minor: '1234', currency: 'USD', order_number: 'DM-ABCD-EFGH' })
    expect(params.payment_intent_data.metadata).toMatchObject({ order_id: ORDER })
    expect(params.line_items).toEqual([
      { quantity: 1, price_data: { currency: 'usd', unit_amount: 1234, product_data: { name: 'DropMarket order DM-ABCD-EFGH' } } },
    ])
    expect(params.success_url).toBe(input.returnUrl)
    expect(params.cancel_url).toBe(input.cancelUrl)
    expect(opts).toEqual({ idempotencyKey: 'dm-checkout:attempt-uuid-1' })
  })

  it('expires the session after an hour and reports that expiry', async () => {
    const api = fakeApi()
    const before = Math.floor(Date.now() / 1000)
    const res = await provider(api).createCharge(input)
    const params = api.checkout.sessions.create.mock.calls[0][0] as any
    expect(params.expires_at - before).toBeGreaterThanOrEqual(60 * 60 - 2)
    expect(params.expires_at - before).toBeLessThanOrEqual(60 * 60 + 2)
    expect(new Date(res.expiresAt!).getTime()).toBe(params.expires_at * 1000)
  })

  it('refuses to create a charge without an idempotency key', async () => {
    await expect(provider(fakeApi()).createCharge({ ...input, idempotencyKey: undefined })).rejects.toThrow(/idempotency/)
  })

  it('refuses a test key in production (test cards would buy real items)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    await expect(provider(fakeApi()).createCharge(input)).rejects.toThrow(/test key/i)
  })

  it('refuses when the secret key is not set', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    await expect(provider(fakeApi()).createCharge(input)).rejects.toThrow(/STRIPE_SECRET_KEY/)
  })
})

describe('stripe: parseWebhook — signature', () => {
  it('rejects a body with no signature header', async () => {
    const { rawBody } = signed(eventOf('checkout.session.completed', { id: 'cs_test_1' }))
    await expect(provider(fakeApi()).parseWebhook({}, rawBody)).rejects.toThrow(/signature/i)
  })

  it('rejects a body signed with another secret', async () => {
    const { headers, rawBody } = signed(eventOf('checkout.session.completed', { id: 'cs_test_1' }), 'whsec_someone_else')
    await expect(provider(fakeApi()).parseWebhook(headers, rawBody)).rejects.toThrow()
  })

  it('rejects a body changed after signing', async () => {
    const { headers, rawBody } = signed(eventOf('checkout.session.completed', { id: 'cs_test_1' }))
    await expect(provider(fakeApi()).parseWebhook(headers, rawBody.replace('cs_test_1', 'cs_test_2'))).rejects.toThrow()
  })

  it('rejects when the webhook secret is not set', async () => {
    const { headers, rawBody } = signed(eventOf('checkout.session.completed', { id: 'cs_test_1' }))
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    await expect(provider(fakeApi()).parseWebhook(headers, rawBody)).rejects.toThrow(/STRIPE_WEBHOOK_SECRET/)
  })

  it('rejects a test-mode event in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_unit_dummy')
    const { headers, rawBody } = signed(eventOf('checkout.session.completed', { id: 'cs_test_1' }))
    await expect(provider(fakeApi()).parseWebhook(headers, rawBody)).rejects.toThrow(/test-mode/)
  })
})

describe('stripe: parseWebhook — authoritative re-fetch', () => {
  it('confirms from the RE-FETCHED session, not the body', async () => {
    const api = fakeApi()
    // The body claims something else entirely; only the id is used.
    const { headers, rawBody } = signed(eventOf('checkout.session.completed', { id: 'cs_test_1', payment_status: 'unpaid', amount_total: 1 }))
    const parsed = await provider(api).parseWebhook(headers, rawBody)
    expect(api.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_test_1')
    expect(parsed.providerEventId).toBe('cs_test_1:completed')
    expect(parsed.events).toEqual([
      { type: 'CHARGE_CONFIRMED', orderId: ORDER, providerChargeId: 'cs_test_1', settled: money(1234n, 'USD'), paid: money(1234n, 'USD') },
    ])
  })

  it('a body claiming paid while Stripe says open does not confirm', async () => {
    const api = fakeApi({ session: { status: 'open', payment_status: 'unpaid' } })
    const { headers, rawBody } = signed(eventOf('checkout.session.completed', { ...PAID_SESSION }))
    const parsed = await provider(api).parseWebhook(headers, rawBody)
    expect(parsed.events[0].type).toBe('CHARGE_PENDING')
  })

  it('async_payment_succeeded reaches the same dedupe key as completed (a no-op the second time)', async () => {
    const a = await provider(fakeApi()).parseWebhook(...Object.values(signed(eventOf('checkout.session.completed', { id: 'cs_test_1' }))) as [any, any])
    const b = await provider(fakeApi()).parseWebhook(...Object.values(signed(eventOf('checkout.session.async_payment_succeeded', { id: 'cs_test_1' }))) as [any, any])
    expect(a.providerEventId).toBe(b.providerEventId)
  })

  it('async_payment_failed fails the charge', async () => {
    const api = fakeApi({ session: { payment_status: 'unpaid' } })
    const { headers, rawBody } = signed(eventOf('checkout.session.async_payment_failed', { id: 'cs_test_1' }))
    const parsed = await provider(api).parseWebhook(headers, rawBody)
    expect(parsed.events).toEqual([{ type: 'CHARGE_FAILED', orderId: ORDER, providerChargeId: 'cs_test_1', reason: 'async_payment_failed' }])
  })

  it('expired fails the charge', async () => {
    const api = fakeApi({ session: { status: 'expired', payment_status: 'unpaid' } })
    const { headers, rawBody } = signed(eventOf('checkout.session.expired', { id: 'cs_test_1' }))
    const parsed = await provider(api).parseWebhook(headers, rawBody)
    expect(parsed.providerEventId).toBe('cs_test_1:expired')
    expect(parsed.events[0]).toMatchObject({ type: 'CHARGE_FAILED', reason: 'expired' })
  })

  it('charge.refunded re-fetches the charge with its refunds; a partial outside refund is a notice', async () => {
    const api = fakeApi()
    const { headers, rawBody } = signed(eventOf('charge.refunded', { id: 'ch_1', amount_refunded: 99999 }))
    const parsed = await provider(api).parseWebhook(headers, rawBody)
    expect(api.charges.retrieve).toHaveBeenCalledWith('ch_1', { expand: ['payment_intent', 'refunds'] })
    expect(parsed.providerEventId).toBe('ch_1:refunded:500:500')
    expect(parsed.events[0]).toMatchObject({ type: 'PAYMENT_NOTICE', kind: 'refund', orderId: ORDER, amount: money(500n, 'USD') })
  })

  it('charge.dispute.created / .closed re-fetch the dispute and open / close a card case', async () => {
    const api = fakeApi()
    const opened = signed(eventOf('charge.dispute.created', { id: 'dp_1' }))
    const parsed = await provider(api).parseWebhook(opened.headers, opened.rawBody)
    expect(api.disputes.retrieve).toHaveBeenCalledWith('dp_1', { expand: ['payment_intent'] })
    expect(parsed.events[0]).toMatchObject({ type: 'CARD_CASE', kind: 'dispute_opened', orderId: ORDER, providerRef: 'dp_1' })
    const closed = signed(eventOf('charge.dispute.closed', { id: 'dp_1' }))
    const after = await provider(api).parseWebhook(closed.headers, closed.rawBody)
    expect(after.providerEventId).toBe('dp_1:closed:lost')
    expect(after.events[0]).toMatchObject({ type: 'CARD_CASE', kind: 'dispute_closed', outcome: 'lost' })
  })

  it('charge.refund.updated re-reads the refund\'s charge and judges its refunds again', async () => {
    const api = fakeApi()
    const { headers, rawBody } = signed(eventOf('charge.refund.updated', { id: 're_9' }))
    const parsed = await provider(api).parseWebhook(headers, rawBody)
    expect(api.refunds.retrieve).toHaveBeenCalledWith('re_9')
    expect(api.charges.retrieve).toHaveBeenCalledWith('ch_1', { expand: ['payment_intent', 'refunds'] })
    expect(parsed.providerEventId).toBe('ch_1:refunded:500:500')
  })

  it('an event type we do not handle is accepted and recorded with no events', async () => {
    const { headers, rawBody } = signed(eventOf('customer.created', { id: 'cus_1' }))
    const parsed = await provider(fakeApi()).parseWebhook(headers, rawBody)
    expect(parsed).toEqual({ providerEventId: 'evt_customer.created:ignored', events: [] })
  })
})

describe('stripe: getCharge / voidCharge', () => {
  it('getCharge reports the re-fetched state', async () => {
    expect(await provider(fakeApi()).getCharge('cs_test_1')).toEqual({ rawStatus: 'completed' })
  })

  it('never voids a paid session', async () => {
    const api = fakeApi()
    expect(await provider(api).voidCharge('cs_test_1')).toEqual({ outcome: 'paid', rawStatus: 'completed' })
    expect(api.checkout.sessions.expire).not.toHaveBeenCalled()
  })

  it('expires an open session', async () => {
    const api = fakeApi({ session: { status: 'open', payment_status: 'unpaid' } })
    expect(await provider(api).voidCharge('cs_test_1')).toEqual({ outcome: 'voided', rawStatus: 'expired' })
    expect(api.checkout.sessions.expire).toHaveBeenCalledWith('cs_test_1')
  })

  it('an already expired session is already closed', async () => {
    const api = fakeApi({ session: { status: 'expired', payment_status: 'unpaid' } })
    expect(await provider(api).voidCharge('cs_test_1')).toEqual({ outcome: 'already_closed', rawStatus: 'expired' })
  })

  it('a session paid while we tried to expire it is paid, never voided', async () => {
    const api = fakeApi({ session: { status: 'open', payment_status: 'unpaid' } })
    api.checkout.sessions.expire.mockRejectedValueOnce(new Error('session is complete'))
    api.checkout.sessions.retrieve
      .mockResolvedValueOnce({ ...PAID_SESSION, status: 'open', payment_status: 'unpaid' })
      .mockResolvedValueOnce({ ...PAID_SESSION })
    expect(await provider(api).voidCharge('cs_test_1')).toEqual({ outcome: 'paid', rawStatus: 'completed' })
  })
})

describe('stripe: refund (Refund To Card outbox)', () => {
  it('refunds the session payment intent with an idempotency key', async () => {
    const api = fakeApi()
    const res = await provider(api).refund!('cs_test_1', money(500n, 'USD'), 'outbox-row-1')
    expect(res).toEqual({ refundId: 're_1' })
    expect(api.refunds.create).toHaveBeenCalledWith(
      // dm_refund marks it as ours: its charge.refunded webhook books nothing.
      { payment_intent: 'pi_1', amount: 500, metadata: { order_id: ORDER, dm_refund: 'outbox-row-1' } },
      { idempotencyKey: 'dm-refund:outbox-row-1' }
    )
  })

  it('refuses a refund in another currency than the charge', async () => {
    await expect(provider(fakeApi()).refund!('cs_test_1', money(500n, 'EUR'), 'k')).rejects.toThrow(/currency/)
  })
})
