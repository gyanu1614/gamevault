/**
 * Payment QR: what it encodes and how it is drawn.
 *
 * Payload: the wallet URI BTCPay Greenfield built for the payment method
 * (`paymentLink`: BIP21 for bitcoin, the plugin's URI for USDT), passed
 * through VERBATIM; the bare deposit address when BTCPay gave no link. We
 * never build or edit the URI ourselves: amount, address, chain and token
 * contract all come from the payment server. `qr.test.ts` pins this.
 *
 * Drawing: plain square modules, pure black on pure white, a 4-module quiet
 * zone, error correction H whenever a centre logo covers part of the symbol.
 * The 2026-10 page drew pale grey (#E9EDF2) rounded dots on white with green
 * finder corners, a 32% logo at level Q and a 4px margin; wallets could not
 * lock onto it.
 */

import { create } from 'qrcode'

/** Quiet zone around the symbol, in modules (ISO 18004 minimum). */
export const QR_QUIET_ZONE = 4

/** Logo width as a fraction of the symbol width (quiet zone excluded). */
export const QR_LOGO_FRACTION = 0.18

/** White padding around the logo, in modules, on each side. */
export const QR_LOGO_PAD = 1

/** The wallet-facing string the QR encodes. `||` on purpose: an empty link
 *  falls back to the address, exactly as the page always did. */
export function qrPayload(method: { paymentLink: string | null; address: string }): string {
  return method.paymentLink || method.address
}

export interface QrDrawing {
  /** Symbol size in modules (quiet zone excluded). */
  size: number
  version: number
  errorCorrection: 'M' | 'H'
  /** Full square side in modules, quiet zone included (the viewBox side). */
  side: number
  /** One SVG path covering every dark module, offset by the quiet zone. */
  path: string
  /** Number of dark modules drawn (for tests). */
  darkModules: number
  /** Centre logo plate in viewBox units, or null without a logo. */
  logo: { x: number; y: number; plate: number; inset: number } | null
}

/**
 * Encode `payload` and turn the module matrix into a single crisp SVG path
 * (one horizontal run per `M…h…v1h…z`). Pure: same input, same drawing, so
 * it renders on the server and in tests.
 */
export function drawQr(payload: string, opts: { withLogo: boolean }): QrDrawing {
  const errorCorrection = opts.withLogo ? 'H' : 'M'
  const qr = create(payload, { errorCorrectionLevel: errorCorrection })
  const { size, data } = qr.modules
  const q = QR_QUIET_ZONE
  let path = ''
  let darkModules = 0
  for (let r = 0; r < size; r++) {
    let c = 0
    while (c < size) {
      if (!data[r * size + c]) {
        c++
        continue
      }
      const start = c
      while (c < size && data[r * size + c]) c++
      const run = c - start
      darkModules += run
      path += `M${start + q} ${r + q}h${run}v1h-${run}z`
    }
  }
  const side = size + q * 2
  let logo: QrDrawing['logo'] = null
  if (opts.withLogo) {
    // Odd mark + odd symbol size keeps the plate on whole modules, centred.
    const target = Math.max(3, Math.round(size * QR_LOGO_FRACTION))
    const mark = target % 2 === 1 ? target : target - 1
    const plate = mark + QR_LOGO_PAD * 2
    const x = (side - plate) / 2
    logo = { x, y: x, plate, inset: QR_LOGO_PAD }
  }
  return { size, version: qr.version, errorCorrection, side, path, darkModules, logo }
}

/** The "Open In Wallet" target: BTCPay's payment URI, unless it is missing
 *  or carries a scheme a browser would run or load as a page instead of
 *  handing it to a wallet app (defence in depth; the link comes from our
 *  own payment server). */
export function walletDeepLink(method: { paymentLink: string | null }): string | null {
  const link = method.paymentLink?.trim()
  if (!link) return null
  if (/^(javascript|data|vbscript|file|blob|about):/i.test(link)) return null
  return link
}
