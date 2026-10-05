import { describe, expect, it } from 'vitest'
import { create } from 'qrcode'
import { drawQr, qrPayload, walletDeepLink, QR_LOGO_FRACTION, QR_QUIET_ZONE } from './qr'

/** Read the encoded text back out of the generated symbol's data segments. */
function encodedText(payload: string, level: 'M' | 'H'): string {
  const qr = create(payload, { errorCorrectionLevel: level })
  return qr.segments
    .map((s: any) => (typeof s.data === 'string' ? s.data : new TextDecoder().decode(s.data)))
    .join('')
}

// Fixtures: the three shapes the payment server hands the page.
const POLYGON_USDT = {
  address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  // EIP-681: token contract @ chain 137, transfer to the deposit address, 37.49 USDT (6 dp).
  paymentLink:
    'ethereum:0xc2132D05D31c914a87C6611C10748AEb04B58e8F@137/transfer?address=0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed&uint256=37490000',
}
const BTC = {
  address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  paymentLink: 'bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=0.00061234&pj=https://pay.example/BTC/pj',
}
const TRON_NO_LINK = { address: 'TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL', paymentLink: null }

describe('qrPayload', () => {
  it('passes the EIP-681 USDT link through verbatim: contract, chain, recipient, amount', () => {
    const p = qrPayload(POLYGON_USDT)
    expect(p).toBe(POLYGON_USDT.paymentLink)
    const m = p.match(/^ethereum:(0x[0-9a-fA-F]{40})@(\d+)\/transfer\?address=(0x[0-9a-fA-F]{40})&uint256=(\d+)$/)
    expect(m).not.toBeNull()
    expect(m![1]).toBe('0xc2132D05D31c914a87C6611C10748AEb04B58e8F')
    expect(m![2]).toBe('137')
    expect(m![3]).toBe(POLYGON_USDT.address)
    expect(m![4]).toBe('37490000')
  })

  it('passes the BIP21 bitcoin link through verbatim', () => {
    expect(qrPayload(BTC)).toBe(BTC.paymentLink)
    const url = new URL(qrPayload(BTC))
    expect(url.protocol).toBe('bitcoin:')
    expect(url.pathname).toBe(BTC.address)
    expect(url.searchParams.get('amount')).toBe('0.00061234')
  })

  it('falls back to the bare address when there is no link (null or empty)', () => {
    expect(qrPayload(TRON_NO_LINK)).toBe(TRON_NO_LINK.address)
    expect(qrPayload({ address: TRON_NO_LINK.address, paymentLink: '' })).toBe(TRON_NO_LINK.address)
  })
})

describe('drawQr', () => {
  it.each([
    ['polygon usdt', POLYGON_USDT],
    ['btc', BTC],
    ['tron address', TRON_NO_LINK],
  ])('%s: the symbol encodes exactly the payload', (_name, fixture) => {
    const payload = qrPayload(fixture)
    expect(encodedText(payload, 'H')).toBe(payload)
    expect(encodedText(payload, 'M')).toBe(payload)
  })

  it('uses error correction H with a logo and M without', () => {
    expect(drawQr(POLYGON_USDT.paymentLink, { withLogo: true }).errorCorrection).toBe('H')
    expect(drawQr(POLYGON_USDT.paymentLink, { withLogo: false }).errorCorrection).toBe('M')
    // The level really reaches the encoder: H needs a larger symbol for the same text.
    const h = drawQr(POLYGON_USDT.paymentLink, { withLogo: true })
    const m = drawQr(POLYGON_USDT.paymentLink, { withLogo: false })
    expect(h.version).toBeGreaterThan(m.version)
  })

  it('draws every dark module once, inside a 4-module quiet zone', () => {
    const payload = qrPayload(POLYGON_USDT)
    const d = drawQr(payload, { withLogo: true })
    const qr = create(payload, { errorCorrectionLevel: 'H' })
    const dark = Array.from(qr.modules.data).filter(Boolean).length
    expect(d.darkModules).toBe(dark)
    expect(d.size).toBe(qr.modules.size)
    expect(d.side).toBe(d.size + 2 * QR_QUIET_ZONE)
    // No run starts inside the quiet zone or spills past the symbol.
    for (const [, x, y, w] of d.path.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
      expect(Number(x)).toBeGreaterThanOrEqual(QR_QUIET_ZONE)
      expect(Number(y)).toBeGreaterThanOrEqual(QR_QUIET_ZONE)
      expect(Number(x) + Number(w)).toBeLessThanOrEqual(QR_QUIET_ZONE + d.size)
    }
  })

  it('keeps the logo plate small and clear of all three finder patterns', () => {
    for (const payload of [qrPayload(POLYGON_USDT), qrPayload(BTC), qrPayload(TRON_NO_LINK), 'x']) {
      const d = drawQr(payload, { withLogo: true })
      const logo = d.logo!
      // Mark ≈ 18% of the symbol; plate adds one module of white each side.
      expect(logo.plate - 2 * logo.inset).toBeLessThanOrEqual(Math.max(3, Math.round(d.size * QR_LOGO_FRACTION)))
      expect((logo.plate * logo.plate) / (d.size * d.size)).toBeLessThan(0.1)
      // Finder pattern + separator = 8x8 modules in three corners (symbol coords).
      const lo = logo.x - QR_QUIET_ZONE
      const hi = lo + logo.plate
      expect(lo).toBeGreaterThanOrEqual(8)
      expect(hi).toBeLessThanOrEqual(d.size - 8)
    }
  })

  it('has no logo plate without a logo', () => {
    expect(drawQr(BTC.paymentLink, { withLogo: false }).logo).toBeNull()
  })
})

describe('walletDeepLink', () => {
  it('returns the wallet URI unchanged', () => {
    expect(walletDeepLink(POLYGON_USDT)).toBe(POLYGON_USDT.paymentLink)
    expect(walletDeepLink(BTC)).toBe(BTC.paymentLink)
  })
  it('is null without a link or for a script/page scheme', () => {
    expect(walletDeepLink(TRON_NO_LINK)).toBeNull()
    expect(walletDeepLink({ paymentLink: '' })).toBeNull()
    expect(walletDeepLink({ paymentLink: 'javascript:alert(1)' })).toBeNull()
    expect(walletDeepLink({ paymentLink: ' JavaScript:alert(1)' })).toBeNull()
    expect(walletDeepLink({ paymentLink: 'data:text/html,hi' })).toBeNull()
  })
})
