/**
 * /api/cron/not-delivered-sweep — finalizes every "Cancel – Not Delivered"
 * report whose grace hour ran out. Pins: the cron bearer is required; every
 * due report is finalized (one failure doesn't stop the rest and is counted);
 * the response says how many were due / auto-cancelled / failed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/email', () => ({}))
const rpc = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc }) }))
const finalize = vi.fn()
vi.mock('@/lib/orders/not-delivered-finalize', () => ({ finalizeNotDelivered: (id: string) => finalize(id) }))

import { GET } from '@/app/api/cron/not-delivered-sweep/route'

const req = (auth?: string) =>
  new NextRequest('https://dropmarket.gg/api/cron/not-delivered-sweep', { headers: auth ? { authorization: auth } : {} })

describe('not-delivered sweep route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-cron-secret'
  })

  it('401 without the cron bearer, and nothing is read', async () => {
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req('Bearer wrong'))).status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('finalizes every due report and reports the counts', async () => {
    rpc.mockResolvedValue({ data: ['o1', 'o2', 'o3'], error: null })
    finalize
      .mockResolvedValueOnce({ outcome: 'auto_cancelled' })
      .mockResolvedValueOnce({ outcome: 'seller_responded' })
      .mockResolvedValueOnce({ outcome: 'auto_cancelled' })
    const res = await GET(req('Bearer test-cron-secret'))
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('order_not_delivered_due', { p_limit: 50 })
    expect(finalize.mock.calls.map((c) => c[0])).toEqual(['o1', 'o2', 'o3'])
    expect(await res.json()).toEqual({ due: 3, autoCancelled: 2, errors: 0 })
  })

  it('one failing report does not stop the others; the run reports 500 with the error count', async () => {
    rpc.mockResolvedValue({ data: ['o1', 'o2'], error: null })
    finalize.mockRejectedValueOnce(new Error('lock timeout')).mockResolvedValueOnce({ outcome: 'auto_cancelled' })
    const res = await GET(req('Bearer test-cron-secret'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ due: 2, autoCancelled: 1, errors: 1 })
  })

  it('a failed list read is a 500', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'db down' } })
    expect((await GET(req('Bearer test-cron-secret'))).status).toBe(500)
    expect(finalize).not.toHaveBeenCalled()
  })
})
