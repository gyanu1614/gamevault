import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { btcpayToCanonical, btcpayEventId, type BtcpayInvoice } from './status-map'
import { makeBtcpayProvider, btcpaySigMatches } from './index'

// Configure the adapter for pure/mocked tests (no live instance).
process.env.BTCPAY_URL ||= 'https://pay.test.local'
process.env.BTCPAY_API_KEY ||= 'test-api-key'
process.env.BTCPAY_STORE_ID ||= 'store-1'
process.env.BTCPAY_WEBHOOK_SECRET ||= 'test-webhook-secret'

const SECRET = process.env.BTCPAY_WEBHOOK_SECRET!
// setup-env loads .env.local, so a machine with real BTCPay creds keeps its
// own store id — the ||= above only fills a fallback. Always build payloads
// from whatever id is actually configured, never a hardcoded one.
const STORE = process.env.BTCPAY_STORE_ID!

const inv = (status: string, extra: Partial<BtcpayInvoice> = {}): BtcpayInvoice => ({
  id: 'inv-1',
  storeId: STORE,
  status,
  additionalStatus: 'None',
  amount: '49.99',
  currency: 'EUR',
  metadata: { orderId: 'order-1' },
  ...extra,
})

// ─── status map ───────────────────────────────────────────────────
describe('btcpay: status -> canonical', () => {
  it('New -> no event', () => expect(btcpayToCanonical(inv('New'))).toHaveLength(0))

  it('Processing -> CHARGE_PENDING', () => {
    expect(btcpayToCanonical(inv('Processing'))[0].type).toBe('CHARGE_PENDING')
  })

  it('Settled -> CHARGE_CONFIRMED with the EUR invoice amount', () => {
    const ev = btcpayToCanonical(inv('Settled'))[0]
    expect(ev.type).toBe('CHARGE_CONFIRMED')
    expect((ev as any).settled).toEqual({ amountMinor: 4999n, currency: 'EUR' })
  })

  it('Settled + PaidOver / Marked still confirms (policy: order proceeds)', () => {
    for (const extra of ['PaidOver', 'Marked']) {
      expect(btcpayToCanonical(inv('Settled', { additionalStatus: extra }))[0].type).toBe(
        'CHARGE_CONFIRMED'
      )
    }
  })

  it('Expired/Invalid -> CHARGE_FAILED, additionalStatus in the reason', () => {
    const plain = btcpayToCanonical(inv('Expired'))[0]
    expect(plain.type).toBe('CHARGE_FAILED')
    expect((plain as any).reason).toBe('expired')
    const partial = btcpayToCanonical(inv('Expired', { additionalStatus: 'PaidPartial' }))[0]
    expect((partial as any).reason).toBe('expired:PaidPartial')
    expect(btcpayToCanonical(inv('Invalid'))[0].type).toBe('CHARGE_FAILED')
  })

  it('rejects an invoice with no metadata.orderId (not ours)', () => {
    expect(() => btcpayToCanonical(inv('Settled', { metadata: {} }))).toThrow(/orderId/)
  })

  it('event id is invoiceId:status', () => {
    expect(btcpayEventId(inv('Settled'))).toBe('inv-1:Settled')
  })
})

// ─── HMAC ─────────────────────────────────────────────────────────
describe('btcpay: BTCPay-Sig HMAC', () => {
  const body = '{"invoiceId":"inv-1"}'
  const sig = 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex')

  it('accepts the correct signature (with and without sha256= prefix)', () => {
    expect(btcpaySigMatches(body, sig, SECRET)).toBe(true)
    expect(btcpaySigMatches(body, sig.slice(7), SECRET)).toBe(true)
  })

  it('rejects a wrong/missing signature or tampered body', () => {
    expect(btcpaySigMatches(body, undefined, SECRET)).toBe(false)
    expect(btcpaySigMatches(body, 'sha256=deadbeef', SECRET)).toBe(false)
    expect(btcpaySigMatches(body + ' ', sig, SECRET)).toBe(false)
  })
})

// ─── full parseWebhook verification chain (mocked fetch) ──────────
describe('btcpay: parseWebhook verification chain', () => {
  const mockFetch = (invoice: Partial<BtcpayInvoice>): typeof fetch =>
    (async (url: any) => {
      const u = String(url)
      if (u.includes('/invoices/')) {
        return { ok: true, json: async () => inv('Settled', invoice) } as any
      }
      return { ok: false, status: 404, text: async () => 'nope' } as any
    }) as any

  const provider = (invoice: Partial<BtcpayInvoice> = {}) =>
    makeBtcpayProvider({ fetchImpl: mockFetch(invoice) })

  // Webhook body claims Settled; the re-fetch is authoritative regardless.
  const body = JSON.stringify({ invoiceId: 'inv-1', storeId: STORE, type: 'InvoiceSettled' })
  const signed = (b: string) => ({
    'btcpay-sig': 'sha256=' + createHmac('sha256', SECRET).update(b).digest('hex'),
  })

  it('happy path: valid HMAC + store + re-fetch Settled -> CHARGE_CONFIRMED', async () => {
    const { providerEventId, events } = await provider().parseWebhook(signed(body), body)
    expect(providerEventId).toBe('inv-1:Settled')
    expect(events[0].type).toBe('CHARGE_CONFIRMED')
  })

  it('STEP 1: rejects a bad signature', async () => {
    await expect(
      provider().parseWebhook({ 'btcpay-sig': 'sha256=deadbeef' }, body)
    ).rejects.toThrow(/HMAC mismatch/)
  })

  it('STEP 2: rejects a webhook for another store', async () => {
    const foreign = JSON.stringify({ invoiceId: 'inv-1', storeId: 'store-EVIL' })
    await expect(provider().parseWebhook(signed(foreign), foreign)).rejects.toThrow(
      /storeId mismatch/
    )
  })

  it('STEP 3: trusts the RE-FETCHED status, not the webhook type', async () => {
    // Body says InvoiceSettled, but the authoritative invoice is Processing.
    const { events } = await provider({ status: 'Processing' }).parseWebhook(signed(body), body)
    expect(events[0].type).toBe('CHARGE_PENDING')
  })

  it('STEP 4: rejects when the re-fetched invoice has no orderId', async () => {
    await expect(provider({ metadata: {} }).parseWebhook(signed(body), body)).rejects.toThrow(
      /orderId/
    )
  })

  it('rejects a body missing invoiceId', async () => {
    const b = JSON.stringify({ type: 'InvoiceSettled' })
    await expect(provider().parseWebhook(signed(b), b)).rejects.toThrow(/missing invoiceId/)
  })
})

// ─── createCharge: the buyer-visible itemDesc carries the order number ────
describe('btcpay: createCharge itemDesc', () => {
  const captureCreate = () => {
    const bodies: any[] = []
    const fetchImpl = (async (url: any, init: any) => {
      if (String(url).endsWith('/invoices') && init?.method === 'POST') {
        bodies.push(JSON.parse(String(init.body)))
        return { ok: true, json: async () => ({ id: 'inv1', status: 'New', checkoutLink: 'https://pay.test.local/i/inv1' }) } as any
      }
      return { ok: false, status: 404, text: async () => 'nope' } as any
    }) as any
    return { bodies, provider: makeBtcpayProvider({ fetchImpl }) }
  }
  const base = {
    orderId: '0f1e2d3c-1111-2222-3333-444444444444',
    amount: { amountMinor: 1234n, currency: 'USD' as const },
    returnUrl: 'https://app.test.local/account/orders/x',
  }

  it('shows the stored order_number; metadata.orderId stays the UUID link', async () => {
    const { bodies, provider } = captureCreate()
    await provider.createCharge({ ...base, orderNumber: 'DM-ABCD-EFGH' })
    expect(bodies[0].metadata.itemDesc).toBe('DropMarket order DM-ABCD-EFGH')
    expect(bodies[0].metadata.orderId).toBe(base.orderId)
  })

  it('an older GV- number is shown as stored', async () => {
    const { bodies, provider } = captureCreate()
    await provider.createCharge({ ...base, orderNumber: 'GV-123456' })
    expect(bodies[0].metadata.itemDesc).toBe('DropMarket order GV-123456')
  })

  it('falls back to the 8-char id prefix only when the order has no number', async () => {
    const { bodies, provider } = captureCreate()
    await provider.createCharge({ ...base })
    expect(bodies[0].metadata.itemDesc).toBe('DropMarket order 0F1E2D3C')
  })
})

// ─── PAY-016: every outbound call carries a deadline ─────────────────────
describe('btcpay: provider fetches carry an AbortSignal timeout (PAY-016)', () => {
  it('invoice create and re-fetch pass an AbortSignal', async () => {
    const signals: unknown[] = []
    const fetchImpl = (async (url: any, init: any) => {
      signals.push(init?.signal)
      if (String(url).endsWith('/invoices') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 'inv1', status: 'New', checkoutLink: 'https://pay.test.local/i/inv1' }) } as any
      }
      return { ok: true, json: async () => ({ id: 'inv1', status: 'New', metadata: { orderId: 'o' } }) } as any
    }) as any
    const provider = makeBtcpayProvider({ fetchImpl })
    await provider.createCharge({
      orderId: '0f1e2d3c-1111-2222-3333-444444444444',
      amount: { amountMinor: 1234n, currency: 'USD' as const },
      returnUrl: 'https://app.test.local/account/orders/x',
    })
    await provider.getCharge('inv1')
    expect(signals.length).toBe(2)
    for (const s of signals) expect(s).toBeInstanceOf(AbortSignal)
  })
})

// ─── voidCharge (round B Part 2, PAY-004) ─────────────────────────────────
describe('btcpay: voidCharge', () => {
  const harness = (status: string, opts: { markOk?: boolean; archiveOk?: boolean } = {}) => {
    const calls: { method: string; url: string; body?: string }[] = []
    const fetchImpl = (async (url: any, init: any) => {
      const u = String(url)
      const method = init?.method ?? 'GET'
      calls.push({ method, url: u, body: init?.body })
      if (method === 'GET' && /\/invoices\/inv-1$/.test(u)) return { ok: true, json: async () => inv(status) } as any
      if (method === 'POST' && u.endsWith('/invoices/inv-1/status')) {
        return opts.markOk === false
          ? ({ ok: false, status: 422, text: async () => 'nope' } as any)
          : ({ ok: true, json: async () => inv('Invalid') } as any)
      }
      if (method === 'DELETE' && /\/invoices\/inv-1$/.test(u)) {
        return opts.archiveOk === false ? ({ ok: false, status: 500, text: async () => 'boom' } as any) : ({ ok: true, json: async () => ({}) } as any)
      }
      return { ok: false, status: 404, text: async () => 'nope' } as any
    }) as any
    return { calls, provider: makeBtcpayProvider({ fetchImpl }) }
  }

  it('New → marks the invoice Invalid, archives it, reports voided', async () => {
    const { calls, provider } = harness('New')
    const r = await provider.voidCharge('inv-1')
    expect(r.outcome).toBe('voided')
    const mark = calls.find((c) => c.method === 'POST')!
    expect(mark.url).toMatch(/\/invoices\/inv-1\/status$/)
    expect(JSON.parse(mark.body!)).toEqual({ status: 'Invalid' })
    expect(calls.some((c) => c.method === 'DELETE' && /\/invoices\/inv-1$/.test(c.url))).toBe(true)
  })

  it('Settled / Processing → paid (money arrived or is in flight — never voided)', async () => {
    for (const s of ['Settled', 'Processing']) {
      const { calls, provider } = harness(s)
      const r = await provider.voidCharge('inv-1')
      expect(r.outcome).toBe('paid')
      expect(r.rawStatus).toBe(s)
      expect(calls.filter((c) => c.method !== 'GET')).toEqual([])
    }
  })

  it('Expired / Invalid → already_closed, nothing written', async () => {
    for (const s of ['Expired', 'Invalid']) {
      const { calls, provider } = harness(s)
      expect((await provider.voidCharge('inv-1')).outcome).toBe('already_closed')
      expect(calls.filter((c) => c.method !== 'GET')).toEqual([])
    }
  })

  it('a refused status mark throws (the outbox retries); a failed archive does not', async () => {
    await expect(harness('New', { markOk: false }).provider.voidCharge('inv-1')).rejects.toThrow(/mark invalid failed 422/)
    expect((await harness('New', { archiveOk: false }).provider.voidCharge('inv-1')).outcome).toBe('voided')
  })
})

// ─── overpayment (round B Part 3, PAY-011) ────────────────────────────────
describe('btcpay: PaidOver carries what was actually paid', () => {
  const harness = (invoice: Partial<BtcpayInvoice>, methods: any[]) => {
    const calls: string[] = []
    const fetchImpl = (async (url: any) => {
      const u = String(url)
      calls.push(u)
      if (/\/invoices\/inv-1\/payment-methods$/.test(u)) return { ok: true, json: async () => methods } as any
      if (/\/invoices\/inv-1$/.test(u)) return { ok: true, json: async () => inv('Settled', invoice) } as any
      return { ok: false, status: 404, text: async () => 'nope' } as any
    }) as any
    return { calls, provider: makeBtcpayProvider({ fetchImpl }) }
  }
  const body = JSON.stringify({ invoiceId: 'inv-1', storeId: STORE, type: 'InvoiceSettled' })
  const signed = (b: string) => ({ 'btcpay-sig': 'sha256=' + createHmac('sha256', SECRET).update(b).digest('hex') })

  it('Settled + PaidOver → paid = Σ totalPaid × rate over the payment methods (invoice currency, cents)', async () => {
    const { provider } = harness({ additionalStatus: 'PaidOver', amount: '49.99', currency: 'USD' }, [
      { paymentMethodId: 'BTC-CHAIN', destination: 'bc1x', totalPaid: '0.0010', rate: '60000.00' }, // 60.00
      { paymentMethodId: 'USDT-TRON', destination: 'Tx', totalPaid: '0', rate: '1.00' },
    ])
    const { events } = await provider.parseWebhook(signed(body), body)
    expect(events[0].type).toBe('CHARGE_CONFIRMED')
    expect((events[0] as any).settled).toEqual({ amountMinor: 4999n, currency: 'USD' })
    expect((events[0] as any).paid).toEqual({ amountMinor: 6000n, currency: 'USD' })
  })

  it('Settled without PaidOver → no payment-methods fetch, paid absent', async () => {
    const { calls, provider } = harness({ additionalStatus: 'None' }, [])
    const { events } = await provider.parseWebhook(signed(body), body)
    expect((events[0] as any).paid).toBeUndefined()
    expect(calls.some((u) => u.includes('/payment-methods'))).toBe(false)
  })

  it('PaidOver with an unusable rate → paid absent (never a guess), the confirmation still stands', async () => {
    const { provider } = harness({ additionalStatus: 'PaidOver' }, [{ paymentMethodId: 'BTC-CHAIN', destination: 'bc1x', totalPaid: '0.001' }])
    const { events } = await provider.parseWebhook(signed(body), body)
    expect(events[0].type).toBe('CHARGE_CONFIRMED')
    expect((events[0] as any).paid).toBeUndefined()
  })
})
