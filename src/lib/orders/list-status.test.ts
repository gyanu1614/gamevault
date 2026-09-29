import { describe, expect, it } from 'vitest'
import { orderListStatus } from './list-status'

describe('orderListStatus', () => {
  it('maps every order status to one plain label', () => {
    expect(orderListStatus('pending').label).toBe('Awaiting Payment')
    expect(orderListStatus('paid').label).toBe('Delivering')
    expect(orderListStatus('delivering').label).toBe('Delivering')
    expect(orderListStatus('delivered').label).toBe('Delivered')
    expect(orderListStatus('disputed').label).toBe('Disputed')
    expect(orderListStatus('completed').label).toBe('Completed')
    expect(orderListStatus('refunded').label).toBe('Refunded')
    expect(orderListStatus('cancelled').label).toBe('Cancelled')
  })

  it('a cancelled order is Cancelled, never Refunded', () => {
    expect(orderListStatus('cancelled').key).toBe('cancelled')
  })

  it('an unknown status falls back to Delivering, not a raw enum', () => {
    expect(orderListStatus('processing').label).toBe('Delivering')
    expect(orderListStatus(null).label).toBe('Delivering')
  })
})
