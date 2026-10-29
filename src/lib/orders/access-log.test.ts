import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
const rpc = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc }) }))
vi.mock('next/headers', () => ({
  headers: () => {
    throw new Error('`headers` was called outside a request scope')
  },
}))

import { recordOrderAccess } from './access-log'

const headers = (h: Record<string, string>) => new Headers(h)

describe('recordOrderAccess', () => {
  beforeEach(() => {
    rpc.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('records the first forwarded hop and the user agent', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    await recordOrderAccess('o1', 'u1', 'view', headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'user-agent': 'Safari' }))
    expect(rpc).toHaveBeenCalledWith('order_access_record', {
      p_order_id: 'o1', p_user_id: 'u1', p_event: 'view', p_ip: '203.0.113.7', p_user_agent: 'Safari',
    })
  })

  it('sends no IP when the request has none', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    await recordOrderAccess('o1', 'u1', 'checkout', headers({}))
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_ip: null, p_user_agent: null })
  })

  it('outside a request (scripts, tests) it skips quietly', async () => {
    await expect(recordOrderAccess('o1', 'u1', 'checkout')).resolves.toBeUndefined()
    expect(rpc).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('never throws: a database error or a crash is only logged', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(recordOrderAccess('o1', 'u1', 'view', headers({}))).resolves.toBeUndefined()
    rpc.mockRejectedValueOnce(new Error('network'))
    await expect(recordOrderAccess('o1', 'u1', 'view', headers({}))).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})
