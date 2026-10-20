import { describe, it, expect, vi, beforeEach } from 'vitest'

const deliver = vi.fn()
let sessionUser: { id: string } | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: sessionUser } }) } }),
}))
vi.mock('@/lib/actions/instant-delivery', () => ({ deliverCodeToBuyer: (...a: unknown[]) => deliver(...a) }))

const ORDER = '0f1e2d3c-1111-4222-8333-444444444444'

describe('revealMyOrderItem — the Order Paid page\'s "Show My Item" for automatic delivery', () => {
  beforeEach(() => {
    deliver.mockReset()
    sessionUser = null
  })

  it('reveals for the SIGNED-IN buyer only (never a buyer id from the browser)', async () => {
    sessionUser = { id: 'buyer-1' }
    deliver.mockResolvedValue({ success: true, code: 'ABCD-1234', deliveryType: 'code' })
    const { revealMyOrderItem } = await import('./order-item-reveal')
    const r = await revealMyOrderItem(ORDER)
    expect(deliver).toHaveBeenCalledWith(ORDER, 'buyer-1')
    expect(r).toEqual({ success: true, code: 'ABCD-1234', deliveryType: 'code' })
  })

  it('signed out → refused, nothing is claimed', async () => {
    const { revealMyOrderItem } = await import('./order-item-reveal')
    const r = await revealMyOrderItem(ORDER)
    expect(r.success).toBe(false)
    expect(deliver).not.toHaveBeenCalled()
  })

  it('a malformed order id → refused before any lookup', async () => {
    sessionUser = { id: 'buyer-1' }
    const { revealMyOrderItem } = await import('./order-item-reveal')
    const r = await revealMyOrderItem('not-a-uuid')
    expect(r.success).toBe(false)
    expect(deliver).not.toHaveBeenCalled()
  })

  it('no code in stock → a buyer-readable message, not the internal error', async () => {
    sessionUser = { id: 'buyer-1' }
    deliver.mockResolvedValue({ success: false, error: 'No codes available for this listing' })
    const { revealMyOrderItem } = await import('./order-item-reveal')
    const r = await revealMyOrderItem(ORDER)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/seller/i)
  })
})
