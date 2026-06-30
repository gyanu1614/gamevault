/**
 * CoinGate adapter (#1) — implements PaymentProvider against CoinGate's
 * sandbox/live API. Crypto, settles EUR, no chargebacks, IRREVERSIBLE refunds.
 *
 * Verification chain in parseWebhook (do not shortcut — spec §5):
 *   1. Source IP in CoinGate's published allowlist.
 *   2. Per-order callback token (?token=) matches (HMAC of order id).
 *   3. RE-FETCH GET /v2/orders/{id} and trust THAT status — never the POST body.
 *   4. Amount + currency match the order's expectation (caller verifies against
 *      the order; here we surface the authoritative settled amount).
 * Dedupe id = "<id>:<status>".
 */

import type {
  PaymentProvider,
  CreateChargeInput,
  CreateChargeResult,
  ParsedWebhook,
} from '@/lib/payments/types'
import { minorToDecimal } from '@/lib/payments/providers/coingate/amount'
import {
  coinGateBase,
  coinGateApiToken,
  COINGATE_RECEIVE_CURRENCY,
  publicApiUrl,
  assertCoinGateConfigured,
} from './env'
import { callbackTokenFor, callbackTokenMatches } from './callback-token'
import { isAllowedIp } from './ip-allowlist'
import { coinGateToCanonical, coinGateEventId, type CoinGateOrder } from './status-map'

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Token ${coinGateApiToken()}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
}

/** Pull the source IP from forwarded headers (route passes these through). */
function sourceIp(headers: Record<string, string>): string | undefined {
  const xff = headers['x-forwarded-for'] ?? headers['X-Forwarded-For']
  if (xff) return xff.split(',')[0].trim()
  return headers['x-real-ip'] ?? headers['X-Real-IP']
}

/**
 * Build the CoinGate provider. `deps` are injectable for testing (fetch + a
 * now() clock for the IP cache). Production uses the defaults.
 */
export function makeCoinGateProvider(deps?: {
  fetchImpl?: typeof fetch
  now?: () => number
}): PaymentProvider {
  const fetchImpl = deps?.fetchImpl ?? fetch
  const now = deps?.now ?? (() => Date.now())

  async function getOrder(id: string): Promise<CoinGateOrder> {
    const res = await fetchImpl(`${coinGateBase()}/orders/${id}`, { headers: authHeaders() })
    if (!res.ok) throw new Error(`coingate: re-fetch failed ${res.status}`)
    return (await res.json()) as CoinGateOrder
  }

  return {
    name: 'coingate',
    capabilities: {
      isCrypto: true,
      supportsEscrowHold: false,
      supportsSplitPayout: false,
      supportsRefund: true,
      chargebackRisk: false,
    },

    async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
      assertCoinGateConfigured()
      const token = callbackTokenFor(input.orderId)
      const body = new URLSearchParams({
        order_id: input.orderId,
        price_amount: minorToDecimal(input.amount),
        price_currency: input.amount.currency,
        receive_currency: COINGATE_RECEIVE_CURRENCY,
        callback_url: `${publicApiUrl()}/api/webhooks/coingate?token=${token}`,
        success_url: input.returnUrl,
        cancel_url: input.returnUrl,
        title: `DropMarket order ${input.orderId}`,
      })
      const res = await fetchImpl(`${coinGateBase()}/orders`, {
        method: 'POST',
        headers: authHeaders(),
        body,
      })
      if (!res.ok) throw new Error(`coingate: create failed ${res.status} ${await res.text()}`)
      const o = (await res.json()) as any
      return { providerChargeId: String(o.id), checkoutUrl: o.payment_url, rawStatus: o.status }
    },

    async getCharge(providerChargeId: string): Promise<{ rawStatus: string }> {
      assertCoinGateConfigured()
      const o = await getOrder(providerChargeId)
      return { rawStatus: o.status }
    },

    async parseWebhook(headers, rawBody): Promise<ParsedWebhook> {
      assertCoinGateConfigured()

      // Body is form-encoded (CoinGate default).
      const form = new URLSearchParams(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
      const cgId = form.get('id')
      const orderId = form.get('order_id')
      if (!cgId || !orderId) throw new Error('coingate: missing id/order_id in callback')

      // STEP 1 — source IP allowlist.
      if (!(await isAllowedIp(sourceIp(headers), now(), fetchImpl))) {
        throw new Error('coingate: source IP not in allowlist')
      }

      // STEP 2 — per-order callback token (from ?token=, route forwards as header).
      const presentedToken = headers['x-cb-token'] ?? headers['X-Cb-Token']
      if (!callbackTokenMatches(orderId, presentedToken)) {
        throw new Error('coingate: callback token mismatch')
      }

      // STEP 3 — authoritative re-fetch (never trust the POST body's status).
      const order = await getOrder(cgId)
      if (order.order_id !== orderId) {
        throw new Error('coingate: re-fetched order_id mismatch')
      }

      // STEP 4 — amount/currency surfaced via canonical event's settled amount;
      // the dispatch/transition layer reconciles against the stored order.
      const events = coinGateToCanonical(order)
      return { providerEventId: coinGateEventId(order), events }
    },

    async refund(providerChargeId, amount, _idempotencyKey) {
      assertCoinGateConfigured()
      // CoinGate refunds are OUTBOUND and IRREVERSIBLE. Implement against the
      // current /v2/orders/{id}/refunds endpoint at integration time; this is
      // gated hardest (admin-only) at the action layer (Phase 6).
      throw new Error('coingate: refund not yet implemented (wire to /v2/orders/{id}/refunds)')
    },
  }
}

/** Default singleton provider (production config from env). */
export const coinGateProvider = makeCoinGateProvider()
