/**
 * Payssion adapter — implements PaymentProvider against Payssion's JSON API.
 * Fiat local methods (Paysafecard/iDEAL/UPI/…): hosted redirect, notify
 * webhook, REAL refund API, chargeback risk (unlike crypto).
 *
 * Verification chain in parseWebhook (spec §5 — do not shortcut):
 *   1. notify_sig MD5 matches (either known scheme, timing-safe).
 *   2. RE-FETCH POST /api/v1/payment/details and trust THAT state — never the
 *      notify body's. Confirm only on state=completed AND paid > 0.
 *   3. orderId comes from the re-fetched transaction (order_id/track_id — set
 *      by us at charge creation to the order UUID).
 * Dedupe id = "<transaction_id>:<state>".
 *
 * Create targets POST {base}/api/v1/payment/create with the docs 6-field
 * signature (LIVE-VERIFIED 2026-09-06 — the WHMCS 7-field variant returns
 * 402 against our production app), retrying once with the 7-field fallback
 * on result_code 402.
 */

import type {
  PaymentProvider,
  CreateChargeInput,
  CreateChargeResult,
  ParsedWebhook,
  ProviderCapabilities,
  VoidChargeResult,
} from '@/lib/payments/types'
import type { Money } from '@/lib/money'
import { toDecimal } from '@/lib/money'
import {
  payssionBase,
  payssionApiKey,
  payssionSecretKey,
  payssionPublicApiUrl,
  assertPayssionConfigured,
} from './env'
import { isPayssionMethod, payssionExpiryIso } from './methods'
import { cancelSig, createSigVariants, detailsSig, notifySigMatches, refundSig } from './sig'
import {
  payssionEventId,
  payssionOrderId,
  payssionToCanonical,
  type PayssionTxn,
} from './status-map'
import { displayOrderRef } from '@/lib/orders/order-number'
import { PROVIDER_FETCH_TIMEOUT_MS } from '@/lib/payments/timeouts'

const CAPABILITIES: ProviderCapabilities = {
  isCrypto: false,
  supportsEscrowHold: false,
  supportsSplitPayout: false,
  supportsRefund: true,
  chargebackRisk: true, // local cards/APMs can dispute — reserve engine applies
}

/** Transaction states that mean "this can no longer be paid". */
const VOID_DEAD_STATES = new Set(['cancelled', 'canceled', 'failed', 'expired', 'rejected', 'blocked', 'error'])

function form(data: Record<string, string>): string {
  return new URLSearchParams(data).toString()
}

/** Parse a notify body that may be form-encoded or JSON (mirrors the
 *  content-type of the original request; we send forms, but stay liberal). */
function parseNotifyBody(rawBody: Buffer | string): Record<string, string> {
  const text = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    const obj = JSON.parse(trimmed) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj)) out[k] = String(v ?? '')
    return out
  }
  return Object.fromEntries(new URLSearchParams(trimmed))
}

export function makePayssionProvider(deps?: { fetchImpl?: typeof fetch }): PaymentProvider {
  const fetchImpl = deps?.fetchImpl ?? fetch

  async function post(path: string, data: Record<string, string>): Promise<any> {
    // PAY-016: a hung provider socket must not pin a serverless invocation.
    const res = await fetchImpl(`${payssionBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form(data),
      signal: AbortSignal.timeout(PROVIDER_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`payssion: ${path} HTTP ${res.status}`)
    return res.json()
  }

  /** Authoritative transaction fetch; retries the sig-without-order_id
   *  variant once on 402 (docs are ambiguous when order_id is omitted). */
  async function fetchDetails(transactionId: string, orderId?: string | null): Promise<PayssionTxn> {
    assertPayssionConfigured()
    const apiKey = payssionApiKey()!
    const secret = payssionSecretKey()!
    const attempt = (sigOrderId: string | null, sendOrderId: boolean) =>
      post('/api/v1/payment/details', {
        api_key: apiKey,
        transaction_id: transactionId,
        ...(sendOrderId && orderId ? { order_id: orderId } : {}),
        api_sig: detailsSig({ apiKey, transactionId, orderId: sigOrderId, secret }),
      })
    let json = await attempt(orderId ?? null, true)
    if (json?.result_code === 402) {
      json = await attempt(null, false)
    }
    if (json?.result_code !== 200 || !json?.transaction) {
      throw new Error(`payssion: details failed (result_code ${json?.result_code})`)
    }
    return json.transaction as PayssionTxn
  }

  return {
    name: 'payssion',
    capabilities: CAPABILITIES,

    async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
      assertPayssionConfigured()
      const pmId = input.metadata?.pm_id
      if (!pmId || !isPayssionMethod(pmId)) {
        throw new Error(`payssion: unknown or missing pm_id "${pmId ?? ''}"`)
      }
      const apiKey = payssionApiKey()!
      const secret = payssionSecretKey()!
      const amount = toDecimal(input.amount) // exact string — it is signed
      const currency = input.amount.currency.toUpperCase()
      const notifyUrl = `${payssionPublicApiUrl()}/api/webhooks/payssion`

      const [sigPrimary, sigFallback] = createSigVariants({
        apiKey,
        pmId,
        amount,
        currency,
        trackId: input.orderId,
        secret,
      })

      const body = (apiSig: string): Record<string, string> => ({
        api_key: apiKey,
        api_sig: apiSig,
        pm_id: pmId,
        amount,
        currency,
        // Our order UUID under BOTH names — WHMCS scheme reads track_id, the
        // docs scheme order_id; the echo of it is the only link back to us.
        track_id: input.orderId,
        order_id: input.orderId,
        // Buyer-visible on Payssion's page: the order number, as stored.
        description: `DropMarket order ${displayOrderRef(input.orderNumber, input.orderId)}`,
        return_url: input.returnUrl,
        notify_url: notifyUrl,
      })

      let json = await post('/api/v1/payment/create', body(sigPrimary))
      if (json?.result_code === 402) {
        // PAY-017: a 402 is assumed to be "signature rejected", but it is not
        // provably signature-only. If the answer nevertheless names a
        // transaction, one WAS minted under this track_id — retrying would
        // bind two transactions to one order. Use it when it is usable,
        // refuse loudly when it is not; retry only a bare 402.
        const mintedId = json?.transaction?.transaction_id as string | undefined
        if (mintedId && json?.redirect_url) {
          console.warn(`[Payssion] 402 with a live transaction ${mintedId} — using it, not re-minting`)
        } else if (mintedId) {
          throw new Error(`payssion: create answered 402 but minted transaction ${mintedId} without a redirect — not retrying (PAY-017)`)
        } else {
          console.warn('[Payssion] docs-scheme sig rejected — retrying WHMCS 7-field fallback')
          json = await post('/api/v1/payment/create', body(sigFallback))
        }
      }
      if (!json?.transaction?.transaction_id || !json?.redirect_url || (json?.result_code !== 200 && json?.result_code !== 402)) {
        throw new Error(`payssion: create failed (result_code ${json?.result_code})`)
      }

      return {
        providerChargeId: json.transaction.transaction_id as string,
        checkoutUrl: json.redirect_url as string, // Payssion-hosted page (absolute)
        rawStatus: (json.transaction.state as string) ?? 'pending',
        // Payssion returns no expiry — apply our per-method window (vouchers
        // get 48h; NEVER the crypto 30-min clock).
        expiresAt: payssionExpiryIso(pmId),
      }
    },

    async getCharge(providerChargeId: string): Promise<{ rawStatus: string }> {
      const txn = await fetchDetails(providerChargeId)
      return { rawStatus: txn.state }
    },

    /**
     * Round B Part 2: POST /payment/cancel. Payssion does not enforce OUR
     * per-method windows, so vouchers stay payable until told otherwise —
     * this is what closes them. A refused cancel falls back to the
     * authoritative state: paid → the money is coming (never voided);
     * a dead state → already closed; still pending → throw, the outbox
     * retries with backoff.
     */
    async voidCharge(providerChargeId: string): Promise<VoidChargeResult> {
      assertPayssionConfigured()
      const apiKey = payssionApiKey()!
      const secret = payssionSecretKey()!
      const json = await post('/api/v1/payment/cancel', {
        api_key: apiKey,
        transaction_id: providerChargeId,
        api_sig: cancelSig({ apiKey, transactionId: providerChargeId, secret }),
      })
      const cancelledState = json?.result_code === 200 ? (json?.transaction?.state as string | undefined) : undefined
      if (cancelledState && VOID_DEAD_STATES.has(cancelledState)) {
        return { outcome: 'voided', rawStatus: cancelledState }
      }
      if (cancelledState === 'completed' || cancelledState === 'paid_more') {
        return { outcome: 'paid', rawStatus: cancelledState }
      }
      // Cancel refused (or answered without a usable state): the details
      // endpoint is the authority.
      const txn = await fetchDetails(providerChargeId)
      if (txn.state === 'completed' || txn.state === 'paid_more') return { outcome: 'paid', rawStatus: txn.state }
      if (VOID_DEAD_STATES.has(txn.state)) return { outcome: 'already_closed', rawStatus: txn.state }
      throw new Error(`payssion: cancel refused (result_code ${json?.result_code}) and transaction ${providerChargeId} is ${txn.state}`)
    },

    async parseWebhook(
      _headers: Record<string, string>,
      rawBody: Buffer | string
    ): Promise<ParsedWebhook> {
      assertPayssionConfigured()
      const apiKey = payssionApiKey()!
      const secret = payssionSecretKey()!

      // STEP 1 — parse + signature gate (either known scheme, timing-safe).
      const payload = parseNotifyBody(rawBody)
      const trackId = payload.track_id || payload.order_id
      if (!payload.transaction_id || !trackId || !payload.state) {
        throw new Error('payssion: notify missing transaction_id/order_id/state')
      }
      const sigOk = notifySigMatches(payload.notify_sig, {
        apiKey,
        pmId: payload.pm_id ?? '',
        amount: payload.amount ?? '',
        currency: payload.currency ?? '',
        trackId,
        subTrackId: payload.sub_track_id ?? '',
        state: payload.state,
        secret,
      })
      if (!sigOk) throw new Error('payssion: notify_sig mismatch')

      // STEP 2 — authoritative re-fetch; never trust the notify body's state.
      const txn = await fetchDetails(payload.transaction_id, trackId)
      // STEP 3 — BIND the transaction to the notify's order id. The details
      // response is the authority: if it names an order id, it must be the
      // one the notify claimed (a mismatched or id-less transaction could
      // otherwise confirm an arbitrary order). Fail closed on both.
      const detailsOrderId = txn.order_id ?? txn.track_id
      if (!detailsOrderId) {
        throw new Error('payssion: details response carries no order id — refusing to bind')
      }
      if (detailsOrderId !== trackId) {
        throw new Error('payssion: notify/details order id mismatch')
      }
      payssionOrderId(txn)

      return {
        providerEventId: payssionEventId(txn),
        events: payssionToCanonical(txn),
      }
    },

    // Real money-out refunds — first provider where this actually works.
    async refund(providerChargeId: string, amount: Money, idempotencyKey: string) {
      assertPayssionConfigured()
      const apiKey = payssionApiKey()!
      const secret = payssionSecretKey()!
      const amountStr = toDecimal(amount)
      const currency = amount.currency.toUpperCase()
      const json = await post('/api/v1/refunds', {
        api_key: apiKey,
        transaction_id: providerChargeId,
        amount: amountStr,
        currency,
        track_id: idempotencyKey.slice(0, 64),
        api_sig: refundSig({ apiKey, transactionId: providerChargeId, amount: amountStr, currency, secret }),
      })
      if (json?.result_code !== 200 || !json?.refund) {
        throw new Error(`payssion: refund failed (result_code ${json?.result_code})`)
      }
      return { refundId: (json.refund.transaction_id as string) ?? providerChargeId }
    },
  }
}

export const payssionProvider: PaymentProvider = makePayssionProvider()

/**
 * Authoritative transaction state for callers that KNOW the order id (the
 * smart return route, the expiry sweep). Signing with the order id matches
 * the documented details signature; retries the id-less variant on 402.
 */
export async function payssionTransactionState(
  transactionId: string,
  orderId?: string | null,
  opts?: { timeoutMs?: number }
): Promise<string> {
  assertPayssionConfigured()
  const apiKey = payssionApiKey()!
  const secret = payssionSecretKey()!
  const timeoutMs = opts?.timeoutMs ?? PROVIDER_FETCH_TIMEOUT_MS
  const attempt = async (sigOrderId: string | null, sendOrderId: boolean) => {
    const res = await fetch(`${payssionBase()}/api/v1/payment/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        api_key: apiKey,
        transaction_id: transactionId,
        ...(sendOrderId && orderId ? { order_id: orderId } : {}),
        api_sig: detailsSig({ apiKey, transactionId, orderId: sigOrderId, secret }),
      }).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    })
    return res.ok ? ((await res.json()) as any) : null
  }
  let json = await attempt(orderId ?? null, !!orderId)
  if (json?.result_code === 402) json = await attempt(null, false)
  if (json?.result_code !== 200 || !json?.transaction?.state) {
    throw new Error(`payssion: details failed (result_code ${json?.result_code})`)
  }
  return json.transaction.state as string
}

