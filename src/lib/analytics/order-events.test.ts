import { describe, expect, it, vi } from 'vitest'
import { orderPaidEvents } from './order-events'

/** Minimal PostgREST stand-in answering per table. */
function fakeClient(answers: Record<string, { data: unknown }>) {
  return {
    from(table: string) {
      const answer = answers[table] ?? { data: null }
      const builder: any = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: answer.data, error: null })
            return () => builder
          },
        },
      )
      return builder
    },
  }
}

const order = { id: 'o1', buyer_id: 'buyer-1', seller_id: 'seller-1', total_amount: 25.5, gameSlug: 'adopt-me' }

describe('orderPaidEvents', () => {
  it('order_paid for the buyer, with the promo (creator) code when one was used', async () => {
    const client = fakeClient({
      orders: { data: [{ id: 'o1' }, { id: 'o0' }] },
      promo_codes: { data: { code: 'ALEX10' } },
    })
    const events = await orderPaidEvents(client, { ...order, promoCodeId: 'p1' })
    expect(events).toEqual([
      {
        event: 'order_paid',
        distinctId: 'buyer-1',
        props: { order_id: 'o1', total_usd: 25.5, game: 'adopt-me', promo_code: 'ALEX10' },
      },
    ])
  })

  it("adds seller_first_sale when this is the seller's only paid order", async () => {
    const client = fakeClient({ orders: { data: [{ id: 'o1' }] } })
    const events = await orderPaidEvents(client, { ...order, promoCodeId: null })
    expect(events.map((e) => e.event)).toEqual(['order_paid', 'seller_first_sale'])
    expect(events[1]).toEqual({
      event: 'seller_first_sale',
      distinctId: 'seller-1',
      props: { order_id: 'o1', total_usd: 25.5, game: 'adopt-me' },
    })
    expect(events[0].props.promo_code).toBeNull()
  })

  it('skips the first-sale check when the read fails (never guesses)', async () => {
    const client = fakeClient({ orders: { data: null } })
    const events = await orderPaidEvents(client, { ...order, promoCodeId: null })
    expect(events.map((e) => e.event)).toEqual(['order_paid'])
  })

  it('swallows a thrown read and still reports the sale', async () => {
    const client = { from: vi.fn(() => { throw new Error('db down') }) }
    const events = await orderPaidEvents(client, { ...order, promoCodeId: 'p1' })
    expect(events.map((e) => e.event)).toEqual(['order_paid'])
  })
})
