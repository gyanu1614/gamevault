/**
 * Per-order callback token (CoinGate verification step 2).
 *
 * We embed `?token=<t>` in the callback_url given to CoinGate at order
 * creation. On callback we verify the token matches the order. Rather than
 * store a random token per order, we derive it as an HMAC of the order id with
 * a server secret — so verification is stateless and timing-safe, and a forged
 * callback can't guess it without the secret.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { coinGateCallbackSecret } from './env'

function secret(): string {
  const s = coinGateCallbackSecret()
  if (!s) {
    throw new Error('[CoinGate] COINGATE_CALLBACK_TOKEN_SECRET is not set.')
  }
  return s
}

/** Deterministic per-order callback token. */
export function callbackTokenFor(orderId: string): string {
  return createHmac('sha256', secret()).update(orderId).digest('hex')
}

/** Timing-safe check that a presented token matches the order. */
export function callbackTokenMatches(orderId: string, presented: string | undefined): boolean {
  if (!presented) return false
  const expected = callbackTokenFor(orderId)
  // Lengths must match for timingSafeEqual; both are hex sha256 (64 chars).
  if (presented.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(presented), Buffer.from(expected))
  } catch {
    return false
  }
}
