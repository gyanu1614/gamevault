/**
 * BTCPay Server adapter (#2) — implements PaymentProvider against our
 * self-hosted BTCPay instance over the Greenfield API. Crypto (BTC / LTC /
 * USDT via the official Tether plugin), invoices priced in EUR, no
 * chargebacks, and — because the store is watch-only — NO outbound sends:
 * refunds are DropMarket-wallet ledger credits, never on-chain.
 *
 * Verification chain in parseWebhook (mirrors the CoinGate rigor, spec §5):
 *   1. HMAC: BTCPay-Sig = sha256=<hex HMAC of the RAW body> with the
 *      store webhook secret (timing-safe compare).
 *   2. storeId in the payload matches OUR store.
 *   3. RE-FETCH the invoice via Greenfield and trust THAT status — never the
 *      webhook body's event type.
 *   4. orderId comes from the re-fetched invoice's metadata (we set it at
 *      creation); an invoice without one is rejected as not ours.
 * Dedupe id = "<invoiceId>:<status>".
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type {
  PaymentProvider,
  CreateChargeInput,
  CreateChargeResult,
  ParsedWebhook,
} from '@/lib/payments/types'
import { toDecimal } from '@/lib/money'
import {
  btcpayBase,
  btcpayApiKey,
  btcpayStoreId,
  btcpayWebhookSecret,
  assertBtcpayConfigured,
  BTCPAY_INVOICE_EXPIRY_MINUTES,
  BTCPAY_MONITORING_MINUTES,
} from './env'
import { btcpayToCanonical, btcpayEventId, type BtcpayInvoice } from './status-map'

function authHeaders(): Record<string, string> {
  return {
    Authorization: `token ${btcpayApiKey()}`,
    'Content-Type': 'application/json',
  }
}

/** One payable method on an invoice (Greenfield payment-methods model).
 *  paymentMethodId examples: "BTC-CHAIN", "LTC-CHAIN", plugin-defined ids for
 *  USDT. Typed defensively — plugins vary the optional fields. */
export interface BtcpayPaymentMethod {
  paymentMethodId: string
  currency?: string
  cryptoCode?: string
  destination: string // the per-invoice deposit address
  paymentLink?: string // BIP21-style URI for QR/wallet deep link
  rate?: string
  amount?: string // total priced in crypto
  due?: string // remaining to pay in crypto
  totalPaid?: string
}

/** Verify BTCPay-Sig (sha256=<hex>) over the raw body, timing-safe. */
export function btcpaySigMatches(rawBody: string, header: string | undefined, secret: string): boolean {
  if (!header) return false
  const presented = header.startsWith('sha256=') ? header.slice(7) : header
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(presented, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Build the BTCPay provider. `deps` are injectable for testing (fetch).
 * Production uses the defaults.
 */
export function makeBtcpayProvider(deps?: { fetchImpl?: typeof fetch }): PaymentProvider {
  const fetchImpl = deps?.fetchImpl ?? fetch

  async function getInvoice(id: string): Promise<BtcpayInvoice> {
    const res = await fetchImpl(
      `${btcpayBase()}/api/v1/stores/${btcpayStoreId()}/invoices/${id}`,
      { headers: authHeaders() }
    )
    if (!res.ok) throw new Error(`btcpay: invoice re-fetch failed ${res.status}`)
    return (await res.json()) as BtcpayInvoice
  }

  return {
    name: 'btcpay',
    capabilities: {
      isCrypto: true,
      supportsEscrowHold: false,
      supportsSplitPayout: false,
      // Watch-only xpub: the server cannot spend, so no programmatic refunds.
      // Refunds are wallet-ledger credits (dispatch layer / admin), or a
      // manual cold-wallet send by the owner.
      supportsRefund: false,
      chargebackRisk: false,
    },

    async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
      assertBtcpayConfigured()
      const body = JSON.stringify({
        amount: toDecimal(input.amount),
        currency: input.amount.currency,
        // orderId in metadata is the ONLY link back to our order — the webhook
        // path re-fetches the invoice and reads it from there (verified data,
        // set by us at creation, never from the webhook body).
        metadata: {
          orderId: input.orderId,
          itemDesc: `DropMarket order ${input.orderId}`,
          ...(input.metadata ?? {}),
        },
        checkout: {
          expirationMinutes: BTCPAY_INVOICE_EXPIRY_MINUTES,
          monitoringMinutes: BTCPAY_MONITORING_MINUTES,
          // 1-conf policy (store speedPolicy MediumSpeed is the backstop;
          // explicit here so a store misconfig can't silently loosen it).
          speedPolicy: 'MediumSpeed',
          redirectURL: input.returnUrl,
          redirectAutomatically: true,
        },
      })
      const res = await fetchImpl(`${btcpayBase()}/api/v1/stores/${btcpayStoreId()}/invoices`, {
        method: 'POST',
        headers: authHeaders(),
        body,
      })
      if (!res.ok) throw new Error(`btcpay: create failed ${res.status} ${await res.text()}`)
      const inv = (await res.json()) as BtcpayInvoice
      return {
        providerChargeId: inv.id,
        // BTCPay's own hosted checkout link. The checkout action overrides
        // this with our native /checkout/pay/<orderId> page; kept as the
        // truthful provider-side URL (also a manual fallback).
        checkoutUrl: inv.checkoutLink ?? `${btcpayBase()}/i/${inv.id}`,
        rawStatus: inv.status,
        expiresAt: inv.expirationTime
          ? new Date(inv.expirationTime * 1000).toISOString()
          : new Date(Date.now() + BTCPAY_INVOICE_EXPIRY_MINUTES * 60 * 1000).toISOString(),
      }
    },

    async getCharge(providerChargeId: string): Promise<{ rawStatus: string }> {
      assertBtcpayConfigured()
      const inv = await getInvoice(providerChargeId)
      return { rawStatus: inv.status }
    },

    async parseWebhook(headers, rawBody): Promise<ParsedWebhook> {
      assertBtcpayConfigured()
      const secret = btcpayWebhookSecret()
      if (!secret) throw new Error('btcpay: BTCPAY_WEBHOOK_SECRET is not set')

      const raw = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')

      // STEP 1 — HMAC over the raw bytes.
      const sig = headers['btcpay-sig'] ?? headers['BTCPay-Sig']
      if (!btcpaySigMatches(raw, sig, secret)) {
        throw new Error('btcpay: BTCPay-Sig HMAC mismatch')
      }

      // Payload gives us WHICH invoice; nothing else from it is trusted.
      let payload: { invoiceId?: string; storeId?: string; type?: string }
      try {
        payload = JSON.parse(raw)
      } catch {
        throw new Error('btcpay: webhook body is not JSON')
      }
      if (!payload.invoiceId) throw new Error('btcpay: missing invoiceId in webhook')

      // STEP 2 — must be OUR store.
      if (payload.storeId && payload.storeId !== btcpayStoreId()) {
        throw new Error('btcpay: webhook storeId mismatch')
      }

      // STEP 3+4 — authoritative re-fetch; orderId from verified metadata.
      const inv = await getInvoice(payload.invoiceId)
      if (inv.storeId && inv.storeId !== btcpayStoreId()) {
        throw new Error('btcpay: re-fetched invoice storeId mismatch')
      }
      const events = btcpayToCanonical(inv)
      return { providerEventId: btcpayEventId(inv), events }
    },
  }
}

/** Default singleton provider (production config from env). */
export const btcpayProvider = makeBtcpayProvider()

// ─── Greenfield read helpers for the native payment page ─────────────
// Server-side only (API key). The pay page renders address/QR/amounts from
// these; the webhook remains the sole authority for order transitions.

export async function btcpayFetchInvoice(invoiceId: string): Promise<BtcpayInvoice> {
  assertBtcpayConfigured()
  const res = await fetch(`${btcpayBase()}/api/v1/stores/${btcpayStoreId()}/invoices/${invoiceId}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`btcpay: invoice fetch failed ${res.status}`)
  return (await res.json()) as BtcpayInvoice
}

export async function btcpayFetchPaymentMethods(invoiceId: string): Promise<BtcpayPaymentMethod[]> {
  assertBtcpayConfigured()
  const res = await fetch(
    `${btcpayBase()}/api/v1/stores/${btcpayStoreId()}/invoices/${invoiceId}/payment-methods`,
    { headers: authHeaders(), cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`btcpay: payment-methods fetch failed ${res.status}`)
  return (await res.json()) as BtcpayPaymentMethod[]
}
