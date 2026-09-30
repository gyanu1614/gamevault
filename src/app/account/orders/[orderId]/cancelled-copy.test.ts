/**
 * A cancelled order only says "nothing was charged" when nothing WAS
 * charged. escrow_status 'refunded' on a cancelled order means it was paid
 * and the money went back to the buyer's wallet (cancelOrder allowPaid,
 * admin-approved cancellations) — the copy must say so.
 */
import { describe, expect, it } from 'vitest'
import React, { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Components use the automatic JSX runtime in Next; the node test transform
// uses the classic one, which expects a global React.
;(globalThis as any).React = React
import { StatusStrip } from './_StatusStrip'
import { OrderStatusCard } from './_OrderStatusCard'

const order = { created_at: '2026-09-27T10:00:00Z', cancelled_at: '2026-09-27T11:00:00Z' }
const strip = (p: Record<string, unknown>) => renderToStaticMarkup(h(StatusStrip as any, p))
const card = (p: Record<string, unknown>) => renderToStaticMarkup(h(OrderStatusCard as any, { order, ...p }))

describe('cancelled order copy', () => {
  it('paid then cancelled: the buyer is told the money is in their wallet', () => {
    const s = strip({ role: 'buyer', status: 'cancelled', escrowStatus: 'refunded' })
    expect(s).toMatch(/returned to your Store Balance/)
    expect(s).toMatch(/Go To Wallet/)
    expect(s).not.toMatch(/Nothing was charged/)
    // Refund policy: store credit is spent, never withdrawn by a buyer.
    expect(s).not.toMatch(/withdraw it/i)
    const c = card({ role: 'buyer', status: 'cancelled', escrowStatus: 'refunded' })
    expect(c).toMatch(/returned to your Store Balance/)
    expect(c).not.toMatch(/nothing was charged/i)
    expect(c).not.toMatch(/withdraw it/i)
  })

  it('never paid: still says nothing was charged, no wallet link', () => {
    const s = strip({ role: 'buyer', status: 'cancelled', escrowStatus: 'pending' })
    expect(s).toMatch(/Nothing was charged/)
    expect(s).not.toMatch(/Go To Wallet/)
    expect(card({ role: 'buyer', status: 'cancelled' })).toMatch(/nothing was charged/i)
  })

  it('the seller sees the buyer was refunded, not "cancelled before payment"', () => {
    expect(strip({ role: 'seller', status: 'cancelled', escrowStatus: 'refunded' })).toMatch(/payment was returned to them/)
    expect(card({ role: 'seller', status: 'cancelled', escrowStatus: 'refunded' })).not.toMatch(/before payment/)
  })
})
