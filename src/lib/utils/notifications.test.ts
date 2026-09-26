/**
 * AUTH-013 — createNotification is the app's shared insert helper. It must
 * write through the service role (the table's INSERT policy is gone) and
 * refuse a non-internal link at write time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ insert: vi.fn(), sessionClient: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: h.sessionClient }))
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({ from: () => ({ insert: h.insert }) }),
}))

import { createNotification } from './notifications'

beforeEach(() => {
  h.insert.mockReset().mockResolvedValue({ error: null })
  h.sessionClient.mockReset()
})

describe('AUTH-013 — createNotification', () => {
  it('inserts an internal-link notification through the service role only', async () => {
    const res = await createNotification({ userId: 'u1', type: 'new_order', title: 'T', message: 'M', link: '/account/orders/1' })
    expect(res.success).toBe(true)
    expect(h.insert).toHaveBeenCalledTimes(1)
    expect(h.insert.mock.calls[0][0]).toMatchObject({ user_id: 'u1', link: '/account/orders/1' })
    expect(h.sessionClient).not.toHaveBeenCalled()
  })

  it('refuses an external / protocol-relative / javascript link and writes nothing', async () => {
    for (const link of ['https://evil.example/x', '//evil.example', 'javascript:alert(1)']) {
      const res = await createNotification({ userId: 'u1', type: 't', title: 'T', message: 'M', link })
      expect(res.success, link).toBe(false)
    }
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('a notification without a link is still fine', async () => {
    const res = await createNotification({ userId: 'u1', type: 't', title: 'T', message: 'M' })
    expect(res.success).toBe(true)
    expect(h.insert).toHaveBeenCalledTimes(1)
  })
})
