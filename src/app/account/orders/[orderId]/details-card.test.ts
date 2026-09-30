/**
 * Order details rail (owner, 2026-09-28 live test):
 *  · the buyer sees ONE "Fees" row (marketplace + payment), the split lives
 *    in a tap-to-open popover — not two rows;
 *  · a refunded / cancelled order shows the seller no payout, never
 *    "Payout After Delivery Is Confirmed";
 *  · cards carry no outline (only their fill; lines separate rows inside).
 */
import { describe, expect, it } from 'vitest'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

;(globalThis as any).React = React
import { OrderDetailsCard } from './_OrderDetailsCard'
import { OrderCard } from './_OrderCard'

const party = { name: 'BloxMarket', username: 'bloxmarket', avatarUrl: '', verified: false, rating: 0, sales: 0, href: '', ctaLabel: 'View store' }
const base = {
  orderNumber: 'DM-JYBT-6MMM',
  orderId: 'b56d2a7a-17f6-4450-b4ca-b1455472f78c',
  placedAtLabel: '28 Sep 2026',
  subtotal: 4.99,
  fee: 0.12,
  totalPaid: 5.34,
  escrowAmount: 5.34,
  feePercent: 2.5,
  netPayout: 4.87,
  otherParty: party,
}
const render = (p: Record<string, unknown>) => renderToStaticMarkup(h(OrderDetailsCard as any, { ...base, ...p }))
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('buyer fees', () => {
  const summary = { itemPrice: 4.99, marketplaceFee: 0.1, paymentFee: 0.25, promoDiscount: 0, total: 5.34, paidWith: 'Crypto' }

  it('one Service Fee row with the combined amount and a breakdown button', () => {
    const html = render({ role: 'buyer', orderStatus: 'paid', paymentSummary: summary })
    const t = text(html)
    expect(t).toMatch(/Service Fee \$0\.35/)
    expect(t).not.toMatch(/Marketplace Fee/)
    expect(t).not.toMatch(/Payment Fee/)
    expect(html).toMatch(/aria-label="Fee breakdown"/)
    expect(t).toMatch(/Total Paid \$5\.34/)
  })

  it('no fees → no Fees row', () => {
    const t = text(render({ role: 'buyer', orderStatus: 'paid', paymentSummary: { ...summary, marketplaceFee: 0, paymentFee: 0, total: 4.99 } }))
    expect(t).not.toMatch(/\bFees\b/)
  })
})

describe('seller payout', () => {
  it('refunded: no payout, no pending-payout promise', () => {
    const t = text(render({ role: 'seller', orderStatus: 'refunded', escrowStatus: 'refunded' }))
    expect(t).toMatch(/Refunded To Buyer −\$4\.99/)
    expect(t).toMatch(/You Receive \$0\.00/)
    expect(t).toMatch(/Refunded To Buyer — No Payout/)
    expect(t).not.toMatch(/Payout After Delivery Is Confirmed/)
    expect(t).not.toMatch(/DropMarket Fee/)
  })

  it('cancelled: no payout', () => {
    const t = text(render({ role: 'seller', orderStatus: 'cancelled' }))
    expect(t).toMatch(/Order Cancelled — No Payout/)
    expect(t).toMatch(/You Receive \$0\.00/)
  })

  it('in progress: the payout and its pending note are unchanged', () => {
    const t = text(render({ role: 'seller', orderStatus: 'delivering' }))
    expect(t).toMatch(/DropMarket Fee · 2\.5% −\$0\.12/)
    expect(t).toMatch(/You Receive \$4\.87/)
    expect(t).toMatch(/Payout After Delivery Is Confirmed/)
  })
})

describe('cards', () => {
  it('have no outline, on any variant', () => {
    for (const variant of ['default', 'glow', 'lime']) {
      const cls = /class="([^"]*)"/.exec(renderToStaticMarkup(h(OrderCard as any, { variant })))![1].split(' ')
      expect(cls.filter((c) => /^(max-sm:|sm:|lg:)?border(-|$)/.test(c)), variant).toEqual([])
    }
  })
})
