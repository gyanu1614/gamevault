import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc }) }))

import { syncNotDelivered } from './not-delivered-sync'

describe('syncNotDelivered', () => {
  beforeEach(() => vi.clearAllMocks())

  it('runs the sync seam and returns its outcome', async () => {
    rpc.mockResolvedValue({ data: { synced: true, outcome: 'expired' }, error: null })
    expect(await syncNotDelivered('o1')).toEqual({ outcome: 'expired' })
    expect(rpc).toHaveBeenCalledWith('order_not_delivered_sync', { p_order_id: 'o1' })
  })

  it('nothing to change → no outcome, with the reason', async () => {
    rpc.mockResolvedValue({ data: { synced: false, reason: 'window' }, error: null })
    expect(await syncNotDelivered('o1')).toEqual({ outcome: null, reason: 'window' })
  })

  it('an RPC error throws (the sweep counts it; the report stays as it was)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(syncNotDelivered('o1')).rejects.toThrow(/boom/)
  })
})
