/**
 * The "Accepted at Checkout" strip shows only methods checkout really
 * offers: a registry method whose fee row is switched off (maya_ph, oxxo_mx,
 * boleto_br, a paused paysafecard) never appears, as a logo or in the
 * screen-reader list (PSP site review, 2026-10-23).
 */
import { describe, it, expect } from 'vitest'

import { marqueeContent } from './PaymentsMarquee'

describe('marqueeContent', () => {
  it('with no live list (dev preview) shows every registry method', () => {
    const { labels } = marqueeContent()
    expect(labels).toEqual(expect.arrayContaining(['Pix', 'Trustly', 'paysafecard', 'Maya', 'OXXO', 'USDT', 'Bitcoin']))
  })

  it('drops methods whose fee row is switched off, keeps the coins', () => {
    const live = ['pix_br', 'trustly', 'blik_pl', 'btcpay']
    const { marks, labels } = marqueeContent(live)
    expect(labels).toEqual(['Pix', 'Trustly', 'BLIK', 'USDT', 'Bitcoin'])
    expect(marks.map((m) => m.key)).not.toContain('paysafecard')
    expect(marks.map((m) => m.key)).toEqual(expect.arrayContaining(['trustly', 'pix_br', 'usdt', 'btc']))
  })

  it('never lists the sandbox method', () => {
    expect(marqueeContent(['payssion_test', 'pix_br']).labels).not.toContain('Payssion Test')
  })
})
