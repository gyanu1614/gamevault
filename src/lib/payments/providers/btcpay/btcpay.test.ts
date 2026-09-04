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

const inv = (status: string, extra: Partial<BtcpayInvoice> = {}): BtcpayInvoice => ({
  id: 'inv-1',
  storeId: 'store-1',
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
  const body = JSON.stringify({ invoiceId: 'inv-1', storeId: 'store-1', type: 'InvoiceSettled' })
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
