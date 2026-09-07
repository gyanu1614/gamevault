import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { payssionToCanonical, payssionEventId, type PayssionTxn } from './status-map'
import { createSigVariants, notifySigMatches, refundSig, detailsSig } from './sig'
import { makePayssionProvider } from './index'
import { providerNameForMethod } from '@/lib/payments/registry'
import { payssionExpiryIso } from './methods'
import { fromDecimal } from '@/lib/money'

// Configure the adapter for pure/mocked tests. ||= only fills fallbacks —
// setup-env loads .env.local, so a machine with real Payssion creds keeps its
// own values and every fixture below derives from env, never hardcodes.
process.env.PAYSSION_API_KEY ||= 'test-api-key'
process.env.PAYSSION_SECRET_KEY ||= 'test-secret'

const API_KEY = process.env.PAYSSION_API_KEY!
const SECRET = process.env.PAYSSION_SECRET_KEY!
const md5 = (s: string) => createHash('md5').update(s).digest('hex')

const txn = (state: string, extra: Partial<PayssionTxn> = {}): PayssionTxn => ({
  transaction_id: 'T100200300',
  pm_id: 'paysafecard',
  amount: '14.98',
  currency: 'USD',
  order_id: 'order-uuid-1',
  paid: '14.98',
  state,
  ...extra,
})

// ─── status map ───────────────────────────────────────────────────
describe('payssion: state -> canonical', () => {
  it('completed with paid > 0 -> CHARGE_CONFIRMED with the invoice amount', () => {
    const ev = payssionToCanonical(txn('completed'))[0]
    expect(ev.type).toBe('CHARGE_CONFIRMED')
    expect((ev as any).settled).toEqual(fromDecimal('14.98', 'USD'))
  })

  it('completed with paid = 0 does NOT confirm (stays pending)', () => {
    expect(payssionToCanonical(txn('completed', { paid: '0.00' }))[0].type).toBe('CHARGE_PENDING')
  })

  it('completed but UNDERPAID does not confirm; exact/over paid does', () => {
    expect(payssionToCanonical(txn('completed', { paid: '14.00' }))[0].type).toBe('CHARGE_PENDING')
    expect(payssionToCanonical(txn('completed', { paid: '14.98' }))[0].type).toBe('CHARGE_CONFIRMED')
    expect(payssionToCanonical(txn('completed', { paid: '15.10' }))[0].type).toBe('CHARGE_CONFIRMED')
  })

  it('paid_more confirms (overpay policy: order proceeds)', () => {
    expect(payssionToCanonical(txn('paid_more'))[0].type).toBe('CHARGE_CONFIRMED')
  })

  it('pending / awaiting_confirm / paid_partial -> CHARGE_PENDING', () => {
    for (const s of ['pending', 'awaiting_confirm', 'paid_partial']) {
      expect(payssionToCanonical(txn(s, { paid: '0.00' }))[0].type).toBe('CHARGE_PENDING')
    }
  })

  it('failure states -> CHARGE_FAILED with state as reason', () => {
    for (const s of ['failed', 'cancelled', 'expired', 'rejected', 'blocked', 'error']) {
      const ev = payssionToCanonical(txn(s, { paid: '0.00' }))[0]
      expect(ev.type).toBe('CHARGE_FAILED')
      expect((ev as any).reason).toBe(s)
    }
  })

  it('refunded -> REFUND_COMPLETED; chargeback/disputed -> CHARGEBACK_OPENED', () => {
    expect(payssionToCanonical(txn('refunded'))[0].type).toBe('REFUND_COMPLETED')
    expect(payssionToCanonical(txn('chargeback'))[0].type).toBe('CHARGEBACK_OPENED')
    expect(payssionToCanonical(txn('disputed'))[0].type).toBe('CHARGEBACK_OPENED')
  })

  it('refund bookkeeping states emit no order event', () => {
    expect(payssionToCanonical(txn('refund_pending'))).toHaveLength(0)
  })

  it('rejects a transaction with no order_id/track_id (not ours)', () => {
    expect(() => payssionToCanonical(txn('completed', { order_id: undefined }))).toThrow(/order_id/)
  })

  it('accepts track_id when order_id is absent (WHMCS field name)', () => {
    const ev = payssionToCanonical(txn('completed', { order_id: undefined, track_id: 'order-uuid-1' }))[0]
    expect((ev as any).orderId).toBe('order-uuid-1')
  })

  it('event id is transactionId:state', () => {
    expect(payssionEventId(txn('completed'))).toBe('T100200300:completed')
  })
})

// ─── signatures ───────────────────────────────────────────────────
describe('payssion: MD5 signatures', () => {
  it('create variants: docs 6-field first (live-verified), WHMCS 7-field fallback', () => {
    const [v1, v2] = createSigVariants({
      apiKey: API_KEY, pmId: 'paysafecard', amount: '14.98', currency: 'USD',
      trackId: 'order-uuid-1', secret: SECRET,
    })
    expect(v1).toBe(md5(`${API_KEY}|paysafecard|14.98|USD|order-uuid-1|${SECRET}`))
    expect(v2).toBe(md5(`${API_KEY}|paysafecard|14.98|USD|order-uuid-1||${SECRET}`))
  })

  it('notify accepts the 8-field scheme AND the docs 7-field scheme, rejects garbage', () => {
    const base = {
      apiKey: API_KEY, pmId: 'paysafecard', amount: '14.98', currency: 'USD',
      trackId: 'order-uuid-1', state: 'completed', secret: SECRET,
    }
    const sig8 = md5(`${API_KEY}|paysafecard|14.98|USD|order-uuid-1||completed|${SECRET}`)
    const sig7 = md5(`${API_KEY}|paysafecard|14.98|USD|order-uuid-1|completed|${SECRET}`)
    expect(notifySigMatches(sig8, base)).toBe(true)
    expect(notifySigMatches(sig7, base)).toBe(true)
    expect(notifySigMatches('deadbeef', base)).toBe(false)
    expect(notifySigMatches(undefined, base)).toBe(false)
  })

  it('details + refund signatures match the documented field order', () => {
    expect(detailsSig({ apiKey: API_KEY, transactionId: 'T1', orderId: 'o1', secret: SECRET }))
      .toBe(md5(`${API_KEY}|T1|o1|${SECRET}`))
    expect(refundSig({ apiKey: API_KEY, transactionId: 'T1', amount: '1.00', currency: 'USD', secret: SECRET }))
      .toBe(md5(`${API_KEY}|T1|1.00|USD|${SECRET}`))
  })
})

// ─── provider routing + expiry policy ─────────────────────────────
describe('payssion: routing + per-method expiry', () => {
  it('enabled pm_ids route to payssion; unknown/un-enabled methods fall back', () => {
    expect(providerNameForMethod('boleto_br')).toBe('payssion')
    expect(providerNameForMethod('oxxo_mx')).toBe('payssion')
    expect(providerNameForMethod('gcash_ph')).toBe('payssion')
    // Not in the registry (not enabled on the app) → never routed to payssion.
    expect(providerNameForMethod('paysafecard')).not.toBe('payssion')
    expect(providerNameForMethod('BTC-CHAIN')).not.toBe('payssion')
    expect(providerNameForMethod(undefined)).not.toBe('payssion')
  })

  it('vouchers get 48h windows, instant methods 1h (never the crypto 30-min clock)', () => {
    const now = Date.now()
    expect(new Date(payssionExpiryIso('boleto_br', now)).getTime() - now).toBe(48 * 60 * 60_000)
    expect(new Date(payssionExpiryIso('oxxo_mx', now)).getTime() - now).toBe(48 * 60 * 60_000)
    expect(new Date(payssionExpiryIso('gcash_ph', now)).getTime() - now).toBe(60 * 60_000)
  })
})

// ─── full parseWebhook verification chain (mocked fetch) ──────────
describe('payssion: parseWebhook verification chain', () => {
  const mockFetch = (details: Partial<PayssionTxn>, resultCode = 200): typeof fetch =>
    (async (url: any) => {
      const u = String(url)
      if (u.includes('/payment/details')) {
        return {
          ok: true,
          json: async () => ({ result_code: resultCode, transaction: txn('completed', details) }),
        } as any
      }
      return { ok: false, status: 404, text: async () => 'nope' } as any
    }) as any

  const provider = (details: Partial<PayssionTxn> = {}) =>
    makePayssionProvider({ fetchImpl: mockFetch(details) })

  const notifyBody = (state: string, sigState = state) => {
    const sig = md5(`${API_KEY}|paysafecard|14.98|USD|order-uuid-1||${sigState}|${SECRET}`)
    return new URLSearchParams({
      transaction_id: 'T100200300',
      pm_id: 'paysafecard',
      amount: '14.98',
      currency: 'USD',
      order_id: 'order-uuid-1',
      state,
      notify_sig: sig,
    }).toString()
  }

  it('happy path: valid sig + re-fetch completed/paid -> CHARGE_CONFIRMED', async () => {
    const { providerEventId, events } = await provider().parseWebhook({}, notifyBody('completed'))
    expect(providerEventId).toBe('T100200300:completed')
    expect(events[0].type).toBe('CHARGE_CONFIRMED')
  })

  it('JSON notify bodies parse too', async () => {
    const sig = md5(`${API_KEY}|paysafecard|14.98|USD|order-uuid-1||completed|${SECRET}`)
    const body = JSON.stringify({
      transaction_id: 'T100200300', pm_id: 'paysafecard', amount: '14.98',
      currency: 'USD', order_id: 'order-uuid-1', state: 'completed', notify_sig: sig,
    })
    const { events } = await provider().parseWebhook({}, body)
    expect(events[0].type).toBe('CHARGE_CONFIRMED')
  })

  it('rejects a bad signature before any fetch', async () => {
    const bad = notifyBody('completed').replace(/notify_sig=[a-f0-9]+/, 'notify_sig=deadbeef')
    await expect(provider().parseWebhook({}, bad)).rejects.toThrow(/notify_sig/)
  })

  it('trusts the RE-FETCHED state, not the notify body', async () => {
    // Notify claims completed; authoritative details say pending.
    const { events } = await provider({ state: 'pending', paid: '0.00' }).parseWebhook(
      {},
      notifyBody('completed')
    )
    expect(events[0].type).toBe('CHARGE_PENDING')
  })

  it('re-fetched completed with paid=0 does NOT confirm', async () => {
    const { events } = await provider({ paid: '0.00' }).parseWebhook({}, notifyBody('completed'))
    expect(events[0].type).toBe('CHARGE_PENDING')
  })

  it('rejects when the notify is missing its ids', async () => {
    await expect(provider().parseWebhook({}, 'state=completed')).rejects.toThrow(/missing/)
  })

  it('SECURITY: rejects when the re-fetched transaction names a DIFFERENT order', async () => {
    // Forged notify claims our expensive order, but the real transaction
    // belongs to another (cheap) order — must fail closed.
    await expect(
      provider({ order_id: 'someone-elses-order' }).parseWebhook({}, notifyBody('completed'))
    ).rejects.toThrow(/mismatch/)
  })

  it('SECURITY: rejects when the re-fetched transaction has no order id at all', async () => {
    await expect(
      provider({ order_id: undefined }).parseWebhook({}, notifyBody('completed'))
    ).rejects.toThrow(/no order id/)
  })

  it('MONEY: completed but underpaid (paid < amount) does NOT confirm', async () => {
    const { events } = await provider({ paid: '5.00' }).parseWebhook({}, notifyBody('completed'))
    expect(events[0].type).toBe('CHARGE_PENDING')
  })
})
