import { describe, expect, it } from 'vitest'
import { buildOrderTimeline } from './timeline'

const T = (h: number) => new Date(Date.UTC(2026, 8, 26, h)).toISOString()
const titles = (steps: ReturnType<typeof buildOrderTimeline>) => steps.map((s) => `${s.title}:${s.state}`)

describe('buildOrderTimeline', () => {
  it('a paid order waits on the seller; nothing is marked started', () => {
    expect(titles(buildOrderTimeline({ status: 'paid', created_at: T(1), paid_at: T(1) }))).toEqual([
      'Order Placed:done',
      'Waiting For Seller:current',
      'Marked As Delivered:upcoming',
      'Order Completed:upcoming',
    ])
  })

  it('the owner example: no response, disputed, delivered, resolved by admin, completed', () => {
    const steps = buildOrderTimeline({
      status: 'completed',
      created_at: T(1), paid_at: T(1),
      disputed_at: T(2), delivered_at: T(5), completed_at: T(6),
      dispute: { reason: 'seller_unresponsive', resolvedAt: T(6), resolvedBy: 'admin', favoredParty: 'seller' },
    })
    expect(titles(steps)).toEqual([
      'Order Placed:done',
      'Waiting For Seller:done',
      'Order Disputed:done',
      'Marked As Delivered:done',
      'Dispute Resolved:done',
      'Order Completed:done',
    ])
    expect(steps[2].detail).toBe('Reason: Seller unresponsive')
    expect(steps[4].detail).toBe("By DropMarket: in the seller's favour")
  })

  it('names the buyer when they closed the dispute themselves', () => {
    const steps = buildOrderTimeline({
      status: 'completed', created_at: T(1), paid_at: T(1), disputed_at: T(2), delivered_at: T(3), completed_at: T(4),
      dispute: { resolvedAt: T(4), resolvedBy: 'buyer', favoredParty: 'seller' },
    })
    expect(steps.find((s) => s.key === 'resolved')?.detail).toBe('Closed by the buyer: order received')
  })

  it('an open dispute is the current step; delivery and resolution stay grey (upcoming)', () => {
    expect(titles(buildOrderTimeline({ status: 'disputed', created_at: T(1), paid_at: T(1), disputed_at: T(2) }))).toEqual([
      'Order Placed:done',
      'Waiting For Seller:done',
      'Order Disputed:current',
      'Marked As Delivered:upcoming',
      'Dispute Resolved:upcoming',
    ])
  })

  it('once resolved, the dispute is history (done), never current', () => {
    const steps = buildOrderTimeline({
      status: 'completed', created_at: T(1), paid_at: T(1), disputed_at: T(2), delivered_at: T(3), completed_at: T(4),
      dispute: { resolvedAt: T(4), resolvedBy: 'buyer', favoredParty: 'seller' },
    })
    expect(steps.filter((s) => s.state !== 'done')).toEqual([])
  })

  it('the happy path uses real timestamps, in order', () => {
    expect(
      titles(
        buildOrderTimeline({
          status: 'completed', created_at: T(1), paid_at: T(1), delivering_at: T(2), delivered_at: T(3), completed_at: T(4),
        }),
      ),
    ).toEqual(['Order Placed:done', 'Delivery Started:done', 'Marked As Delivered:done', 'Order Completed:done'])
  })

  it('a post-completion dispute sorts after completion', () => {
    const steps = buildOrderTimeline({
      status: 'disputed', created_at: T(1), paid_at: T(1), delivering_at: T(2), delivered_at: T(3), completed_at: T(4), disputed_at: T(8),
    })
    expect(titles(steps).slice(0, 5)).toEqual([
      'Order Placed:done', 'Delivery Started:done', 'Marked As Delivered:done', 'Order Disputed:current', 'Dispute Resolved:upcoming',
    ])
  })

  it('an unpaid cancel shows no delivery steps', () => {
    expect(titles(buildOrderTimeline({ status: 'cancelled', created_at: T(1), cancelled_at: T(2) }))).toEqual([
      'Order Placed:done',
      'Order Cancelled:done',
    ])
  })
})
