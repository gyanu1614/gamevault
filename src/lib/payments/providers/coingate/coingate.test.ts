import { describe, it, expect, beforeEach } from 'vitest'
import { coinGateToCanonical, coinGateEventId, type CoinGateOrder } from './status-map'
import { minorToDecimal, decimalToMinor } from './amount'
import { callbackTokenFor, callbackTokenMatches } from './callback-token'
import { makeCoinGateProvider } from './index'
import { __resetIpCache } from './ip-allowlist'
import { money } from '@/lib/money'

// These pure/mocked tests need the callback secret + a token; set them so the
// adapter is "configured" without a live API token.
process.env.COINGATE_API_TOKEN ||= 'test-token'
process.env.COINGATE_CALLBACK_TOKEN_SECRET ||= 'test-callback-secret'

const ALLOWED_IP = '13.213.226.109' // CoinGate sandbox IP (per spec)

// ─── status map ───────────────────────────────────────────────────
describe('coingate: status -> canonical', () => {
  const base = (status: string, extra: Partial<CoinGateOrder> = {}): CoinGateOrder => ({
    id: 555,
    order_id: 'order-1',
    status,
    price_amount: '49.99',
    price_currency: 'EUR',
    ...extra,
  })

  it('new -> no event', () => expect(coinGateToCanonical(base('new'))).toHaveLength(0))
  it('pending/confirming -> CHARGE_PENDING', () => {
    expect(coinGateToCanonical(base('pending'))[0].type).toBe('CHARGE_PENDING')
    expect(coinGateToCanonical(base('confirming'))[0].type).toBe('CHARGE_PENDING')
  })
  it('paid -> CHARGE_CONFIRMED with SETTLED (receive) amount', () => {
    const ev = coinGateToCanonical(base('paid', { receive_amount: '49.50', receive_currency: 'EUR' }))[0]
    expect(ev.type).toBe('CHARGE_CONFIRMED')
    expect((ev as any).settled).toEqual({ amountMinor: 4950n, currency: 'EUR' }) // receive, not price
  })
  it('paid without receive_* falls back to price amount', () => {
    const ev = coinGateToCanonical(base('paid'))[0]
    expect((ev as any).settled).toEqual({ amountMinor: 4999n, currency: 'EUR' })
  })
  it('invalid/expired/canceled -> CHARGE_FAILED', () => {
    for (const s of ['invalid', 'expired', 'canceled']) {
      expect(coinGateToCanonical(base(s))[0].type).toBe('CHARGE_FAILED')
    }
  })
  it('refunded -> REFUND_COMPLETED', () => {
    expect(coinGateToCanonical(base('refunded'))[0].type).toBe('REFUND_COMPLETED')
  })
  it('event id is id:status', () => {
    expect(coinGateEventId(base('paid'))).toBe('555:paid')
  })
})

// ─── amount edge ──────────────────────────────────────────────────
describe('coingate: amount conversion at the boundary', () => {
  it('minor -> decimal and back, exact', () => {
    expect(minorToDecimal(money(4999n, 'EUR'))).toBe('49.99')
    expect(decimalToMinor('49.99', 'EUR').amountMinor).toBe(4999n)
  })
})

// ─── callback token ───────────────────────────────────────────────
describe('coingate: per-order callback token', () => {
  it('matches for the right order, rejects wrong/missing', () => {
    const t = callbackTokenFor('order-1')
    expect(callbackTokenMatches('order-1', t)).toBe(true)
    expect(callbackTokenMatches('order-2', t)).toBe(false)
    expect(callbackTokenMatches('order-1', undefined)).toBe(false)
    expect(callbackTokenMatches('order-1', 'deadbeef')).toBe(false)
  })
})

// ─── full parseWebhook verification chain (mocked fetch) ──────────
describe('coingate: parseWebhook verification chain', () => {
  beforeEach(() => __resetIpCache())

  // Mock fetch: serves the ips-v4 allowlist and the order re-fetch.
  const mockFetch = (order: Partial<CoinGateOrder>): typeof fetch =>
    (async (url: any) => {
      const u = String(url)
      if (u.endsWith('/ips-v4')) {
        return { ok: true, text: async () => `${ALLOWED_IP}\n1.2.3.4\n` } as any
      }
      if (u.includes('/orders/')) {
        return {
          ok: true,
          json: async () => ({
            id: 555,
            order_id: 'order-1',
            status: 'paid',
            price_amount: '49.99',
            price_currency: 'EUR',
            receive_amount: '49.99',
            receive_currency: 'EUR',
            ...order,
          }),
        } as any
      }
      return { ok: false, status: 404, text: async () => 'nope' } as any
    }) as any

  const provider = (order: Partial<CoinGateOrder> = {}) =>
    makeCoinGateProvider({ fetchImpl: mockFetch(order), now: () => 1_000_000 })

  const body = 'id=555&order_id=order-1&status=paid'
  const goodHeaders = () => ({
    'x-forwarded-for': ALLOWED_IP,
    'x-cb-token': callbackTokenFor('order-1'),
  })

  it('happy path: valid IP + token + re-fetch paid -> CHARGE_CONFIRMED', async () => {
    const { providerEventId, events } = await provider().parseWebhook(goodHeaders(), body)
    expect(providerEventId).toBe('555:paid')
    expect(events[0].type).toBe('CHARGE_CONFIRMED')
  })

  it('STEP 1: rejects a source IP not in the allowlist', async () => {
    await expect(
      provider().parseWebhook({ ...goodHeaders(), 'x-forwarded-for': '9.9.9.9' }, body)
    ).rejects.toThrow(/IP not in allowlist/)
  })

  it('STEP 2: rejects a bad/missing callback token', async () => {
    await expect(
      provider().parseWebhook({ ...goodHeaders(), 'x-cb-token': 'wrong' }, body)
    ).rejects.toThrow(/token mismatch/)
  })

  it('STEP 3: trusts the RE-FETCHED status, not the POST body', async () => {
    // Body says paid, but the authoritative order is still pending → PENDING event.
    const { events } = await provider({ status: 'pending' }).parseWebhook(goodHeaders(), body)
    expect(events[0].type).toBe('CHARGE_PENDING')
  })

  it('STEP 3: rejects when re-fetched order_id mismatches', async () => {
    await expect(
      provider({ order_id: 'someone-elses-order' }).parseWebhook(goodHeaders(), body)
    ).rejects.toThrow(/order_id mismatch/)
  })

  it('rejects a callback missing id/order_id', async () => {
    await expect(provider().parseWebhook(goodHeaders(), 'status=paid')).rejects.toThrow(/missing id/)
  })
})

// ─── createCharge: the buyer-visible title carries the order number ───────
describe('coingate: createCharge title', () => {
  process.env.PUBLIC_API_URL ||= 'https://app.test.local'
  const captureCreate = () => {
    const bodies: Record<string, string>[] = []
    const fetchImpl = (async (url: any, init: any) => {
      if (String(url).endsWith('/orders') && init?.method === 'POST') {
        bodies.push(Object.fromEntries(init.body as URLSearchParams))
        return { ok: true, json: async () => ({ id: 42, status: 'new', payment_url: 'https://pay.test/42' }) } as any
      }
      return { ok: false, status: 404, text: async () => 'nope' } as any
    }) as any
    return { bodies, provider: makeCoinGateProvider({ fetchImpl }) }
  }
  const base = {
    orderId: '0f1e2d3c-1111-2222-3333-444444444444',
    amount: money(1234n, 'USD'),
    returnUrl: 'https://app.test.local/account/orders/x',
  }

  it('shows the stored order_number; order_id stays the UUID link', async () => {
    const { bodies, provider } = captureCreate()
    await provider.createCharge({ ...base, orderNumber: 'DM-ABCD-EFGH' })
    expect(bodies[0].title).toBe('DropMarket order DM-ABCD-EFGH')
    expect(bodies[0].order_id).toBe(base.orderId)
  })

  it('an older GV- number is shown as stored', async () => {
    const { bodies, provider } = captureCreate()
    await provider.createCharge({ ...base, orderNumber: 'GV-123456' })
    expect(bodies[0].title).toBe('DropMarket order GV-123456')
  })

  it('falls back to the 8-char id prefix only when the order has no number', async () => {
    const { bodies, provider } = captureCreate()
    await provider.createCharge({ ...base })
    expect(bodies[0].title).toBe('DropMarket order 0F1E2D3C')
  })
})
