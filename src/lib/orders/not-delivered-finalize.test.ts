import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendOrderRefundedEmail = vi.fn()
vi.mock('@/lib/email', () => ({ sendOrderRefundedEmail: (...a: unknown[]) => sendOrderRefundedEmail(...a) }))
const postOrderSystemNotice = vi.fn()
vi.mock('@/lib/chat/post-system-notice', () => ({ postOrderSystemNotice: (...a: unknown[]) => postOrderSystemNotice(...a) }))
const rpc = vi.fn()
const from = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc, from }) }))

import { finalizeNotDelivered } from './not-delivered-finalize'

const orderRow = { data: { order_number: 'DM-AB12-CD34', buyer_id: 'u1', total_amount: 74.97, listing: { title: 'Shadow Dragon', game: { slug: 'adopt-me' } } } }
const buyerRow = { data: { email: 'buyer@example.test', username: 'b', full_name: null } }
const chain = (row: unknown) => ({ select: () => ({ eq: () => ({ single: async () => row }) }) })

describe('finalizeNotDelivered', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendOrderRefundedEmail.mockResolvedValue({ success: true })
    postOrderSystemNotice.mockResolvedValue(undefined)
    from.mockImplementation((t: string) => chain(t === 'orders' ? orderRow : buyerRow))
  })

  it('auto-cancel → the refund email for the credited amount (with the full card amount) + a chat notice', async () => {
    rpc.mockResolvedValue({ data: { finalized: true, outcome: 'auto_cancelled', credited_minor: 7000, total_minor: 7497 }, error: null })
    expect(await finalizeNotDelivered('o1')).toEqual({ outcome: 'auto_cancelled' })
    expect(rpc).toHaveBeenCalledWith('order_not_delivered_finalize', { p_order_id: 'o1' })
    expect(sendOrderRefundedEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'buyer@example.test', orderNumber: 'DM-AB12-CD34', amount: 70, fullAmount: 74.97, destination: 'your Store Balance',
    }))
    expect(postOrderSystemNotice).toHaveBeenCalledWith('o1', expect.objectContaining({ type: 'order_cancelled', by: 'system' }))
  })

  it('inside the grace / no open report → nothing sent', async () => {
    rpc.mockResolvedValue({ data: { finalized: false, reason: 'grace' }, error: null })
    expect(await finalizeNotDelivered('o1')).toEqual({ outcome: null, reason: 'grace' })
    expect(sendOrderRefundedEmail).not.toHaveBeenCalled()
    expect(postOrderSystemNotice).not.toHaveBeenCalled()
  })

  it('the seller responded → no refund comms', async () => {
    rpc.mockResolvedValue({ data: { finalized: true, outcome: 'seller_responded' }, error: null })
    expect(await finalizeNotDelivered('o1')).toEqual({ outcome: 'seller_responded' })
    expect(sendOrderRefundedEmail).not.toHaveBeenCalled()
  })

  it('a comms failure never throws (the money already moved in SQL)', async () => {
    rpc.mockResolvedValue({ data: { finalized: true, outcome: 'auto_cancelled', credited_minor: 7000, total_minor: 7497 }, error: null })
    sendOrderRefundedEmail.mockRejectedValueOnce(new Error('resend down'))
    await expect(finalizeNotDelivered('o1')).resolves.toEqual({ outcome: 'auto_cancelled' })
  })

  it('an RPC error throws (the sweep counts it; the claim stays open for the next run)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(finalizeNotDelivered('o1')).rejects.toThrow(/boom/)
  })
})
