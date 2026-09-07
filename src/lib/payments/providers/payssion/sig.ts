/**
 * Payssion MD5 signatures.
 *
 * Payssion signs requests/notifies with md5 over pipe-joined fields + the
 * secret key. Two schemes are in the wild:
 *   · the WHMCS-plugin-verified scheme, which includes an empty sub_track_id
 *     slot (create: 7 fields; notify: 8 fields) and names the order id
 *     `track_id`;
 *   · the public docs scheme without the sub_track_id slot (`order_id`).
 * We SEND the verified scheme first and retry once with the docs scheme on a
 * 402 (invalid signature); we ACCEPT either on notify — the signature is only
 * the gate, the authoritative /payment/details re-fetch decides state.
 *
 * All values must be the EXACT strings sent/received (never re-format the
 * amount before signing/verifying).
 */

import { createHash, timingSafeEqual } from 'node:crypto'

export function md5(s: string): string {
  return createHash('md5').update(s).digest('hex')
}

/** Constant-time compare of two hex strings (length leak is fine — md5 is fixed-width). */
export function sigEquals(a: string, b: string | null | undefined): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(String(b ?? ''))
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/** Create-payment signature candidates, preferred order.
 *  LIVE-VERIFIED 2026-09-06 against our production app: the docs 6-field
 *  scheme is the one the API accepts (the WHMCS 7-field variant got 402), so
 *  it goes first; the 7-field stays as the fallback. */
export function createSigVariants(input: {
  apiKey: string
  pmId: string
  amount: string
  currency: string
  trackId: string
  secret: string
}): string[] {
  const { apiKey, pmId, amount, currency, trackId, secret } = input
  return [
    // Docs scheme (no sub_track_id slot) — live-verified.
    md5([apiKey, pmId, amount, currency, trackId, secret].join('|')),
    // WHMCS-plugin scheme: empty sub_track_id slot (fallback).
    md5([apiKey, pmId, amount, currency, trackId, '', secret].join('|')),
  ]
}

/** Notify signature check — accepts either known scheme. */
export function notifySigMatches(
  notifySig: string | null | undefined,
  input: {
    apiKey: string
    pmId: string
    amount: string
    currency: string
    trackId: string
    subTrackId?: string | null
    state: string
    secret: string
  }
): boolean {
  const { apiKey, pmId, amount, currency, trackId, subTrackId, state, secret } = input
  const candidates = [
    md5([apiKey, pmId, amount, currency, trackId, subTrackId ?? '', state, secret].join('|')),
    md5([apiKey, pmId, amount, currency, trackId, state, secret].join('|')),
  ]
  return candidates.some((c) => sigEquals(c, notifySig))
}

/** /payment/details signature (docs: api_key|transaction_id|order_id|secret). */
export function detailsSig(input: {
  apiKey: string
  transactionId: string
  orderId?: string | null
  secret: string
}): string {
  const { apiKey, transactionId, orderId, secret } = input
  return md5([apiKey, transactionId, orderId ?? '', secret].join('|'))
}

/** /refunds signature (api_key|transaction_id|amount|currency|secret). */
export function refundSig(input: {
  apiKey: string
  transactionId: string
  amount: string
  currency: string
  secret: string
}): string {
  const { apiKey, transactionId, amount, currency, secret } = input
  return md5([apiKey, transactionId, amount, currency, secret].join('|'))
}
