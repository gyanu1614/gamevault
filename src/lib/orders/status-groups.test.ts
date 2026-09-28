import { describe, expect, it } from 'vitest'
import { countByStatusGroup, inStatusGroup } from './status-groups'

describe('order status groups', () => {
  it('every real status lands in exactly one group', () => {
    const all = ['pending', 'paid', 'delivering', 'delivered', 'disputed', 'completed', 'cancelled', 'refunded']
    const counts = countByStatusGroup(all)
    expect(counts.in_progress + counts.completed + counts.disputed + counts.closed).toBe(all.length)
    expect(counts).toMatchObject({ all: 8, in_progress: 4, completed: 1, disputed: 1, closed: 2 })
  })

  it('delivered-but-unconfirmed is in progress, not completed', () => {
    expect(inStatusGroup('delivered', 'in_progress')).toBe(true)
    expect(inStatusGroup('delivered', 'completed')).toBe(false)
  })

  it('refunded and cancelled are filterable', () => {
    expect(inStatusGroup('refunded', 'closed')).toBe(true)
    expect(inStatusGroup('cancelled', 'closed')).toBe(true)
    expect(inStatusGroup('processing', 'in_progress')).toBe(false)
  })
})
