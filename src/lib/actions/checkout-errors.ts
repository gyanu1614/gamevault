/**
 * Buyer-facing copy for a failed charge creation. Pure (no 'use server'):
 * createCheckout calls it, and its test pins the mapping.
 *
 *   result_code 417        → under the method's minimum: pick another method
 *   result_code 4xx (else) → the provider refused this method: pick another
 *   anything else          → network / 5xx: the service is down, try shortly
 */

export const PROVIDER_UNAVAILABLE_MESSAGE =
  'The payment service is temporarily unavailable. Nothing was charged, and any wallet credit you applied is back in your wallet. Please try again shortly.'

export const METHOD_REFUSED_MESSAGE =
  'This payment method isn’t working right now. Nothing was charged, and any wallet credit you applied is back in your wallet. Please pick another payment method.'

export const BELOW_PROVIDER_MINIMUM_MESSAGE =
  'This order is under the minimum amount for that payment method — nothing was charged, and any wallet credit you applied is back in your wallet. Please pick another payment method.'

export function chargeFailureMessage(err: unknown): string {
  const msg = String((err as { message?: unknown } | null)?.message ?? err ?? '')
  const code = /result_code (\d{3})/.exec(msg)?.[1]
  if (code === '417') return BELOW_PROVIDER_MINIMUM_MESSAGE
  if (code && code.startsWith('4')) return METHOD_REFUSED_MESSAGE
  return PROVIDER_UNAVAILABLE_MESSAGE
}
