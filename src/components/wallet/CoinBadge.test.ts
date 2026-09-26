/**
 * CoinBadge — which mark each payout method draws. Payoneer used the stacked
 * logo PNG (ring over a dark wordmark), unreadable at badge size on the dark
 * tile; it now draws its ring mark in CSS, like the coin marks, with no asset.
 */
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import CoinBadge from './CoinBadge'

// tsconfig's `jsx: preserve` leaves vitest on the classic transform.
;(globalThis as { React?: typeof React }).React = React
vi.mock('next/image', () => ({ default: (p: { src: string }) => React.createElement('img', { src: p.src, alt: '' }) }))

const render = (props: { coin?: string | null; methodName: string; muted?: boolean }) =>
  renderToStaticMarkup(React.createElement(CoinBadge, props))

describe('CoinBadge', () => {
  it('Payoneer draws its gradient ring: no image, no lettermark', () => {
    const html = render({ coin: null, methodName: 'payoneer' })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('payoneer.png')
    expect(html).toContain('conic-gradient(#EB9E00')
    expect(html).toMatch(/mask:radial-gradient\(farthest-side, transparent calc\(100% - 2px - 0\.5px\), #000 calc\(100% - 2px\)\)/)
    expect(html).toContain('aria-hidden')
  })

  it('the ring scales with the badge and keeps a 2px floor', () => {
    expect(renderToStaticMarkup(React.createElement(CoinBadge, { methodName: 'payoneer', size: 80 }))).toContain('width:48px;height:48px')
    expect(renderToStaticMarkup(React.createElement(CoinBadge, { methodName: 'payoneer', size: 80 }))).toContain('calc(100% - 4px)')
    expect(renderToStaticMarkup(React.createElement(CoinBadge, { methodName: 'payoneer', size: 20 }))).toContain('calc(100% - 2px)')
  })

  it('a coming-soon Payoneer is dimmed like every other rail', () => {
    expect(render({ methodName: 'payoneer', muted: true })).toContain('grayscale')
  })

  it('other methods keep their marks: coin artwork, coin lettermark, fiat artwork, fallback', () => {
    expect(render({ coin: 'btc', methodName: 'btc' })).toContain('/payment-methods/btc.png')
    expect(render({ coin: 'usdt', methodName: 'usdt_trc20' })).toContain('₮')
    expect(render({ coin: null, methodName: 'paypal' })).toContain('/payment-methods/paypal.png')
    expect(render({ coin: null, methodName: 'wise' })).toContain('>wi<')
  })
})
