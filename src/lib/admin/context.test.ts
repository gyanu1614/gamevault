import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUser = vi.fn()
const rpc = vi.fn()
const update = vi.fn()
const eq = vi.fn()
let requestHeaders: object | null = {}

vi.mock('next/headers', () => ({
  headers: () => {
    if (!requestHeaders) throw new Error('headers() outside a request')
    return requestHeaders
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser }, rpc }),
}))
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({ from: () => ({ update }) }),
}))

const USER = { id: 'u1', email: 'staff@example.com' }

function staffRow(over: Record<string, unknown> = {}) {
  return {
    aal: 'aal2',
    role: 'moderator',
    is_active: true,
    last_active_at: new Date().toISOString(),
    permissions: ['listings.review'],
    username: 'mod',
    full_name: 'Mod One',
    avatar_url: null,
    ...over,
  }
}

async function load() {
  vi.resetModules()
  return import('./context')
}

describe('admin gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requestHeaders = {}
    getUser.mockResolvedValue({ data: { user: USER } })
    rpc.mockResolvedValue({ data: staffRow(), error: null })
    update.mockReturnValue({ eq })
    eq.mockResolvedValue({ error: null })
  })

  it('no session: signed_out, and it never asks the database', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const { getAdminGate } = await load()
    expect((await getAdminGate()).status).toBe('signed_out')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('not staff: not_admin', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const { getAdminGate } = await load()
    expect((await getAdminGate()).status).toBe('not_admin')
  })

  it('an RPC error fails closed', async () => {
    rpc.mockResolvedValue({ data: staffRow(), error: { message: 'boom' } })
    const { getAdminGate } = await load()
    expect((await getAdminGate()).status).toBe('not_admin')
  })

  it.each([['aal1'], [null], [undefined], ['']])('staff without two-factor (aal %s): needs_mfa, never ok', async (aal) => {
    rpc.mockResolvedValue({ data: staffRow({ aal }), error: null })
    const { getAdminGate, getVerifiedAdmin } = await load()
    expect((await getAdminGate()).status).toBe('needs_mfa')
    expect(await getVerifiedAdmin()).toBeNull()
  })

  it('staff with two-factor: ok, with role, permissions and profile from one RPC', async () => {
    const { getVerifiedAdmin } = await load()
    expect(await getVerifiedAdmin()).toMatchObject({
      userId: 'u1',
      email: 'staff@example.com',
      role: 'moderator',
      isActive: true,
      permissions: ['listings.review'],
      username: 'mod',
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('admin_context')
  })

  it('answers once per request, however many callers', async () => {
    const { getAdminGate, getVerifiedAdmin } = await load()
    await Promise.all([getAdminGate(), getVerifiedAdmin(), getAdminGate()])
    await getVerifiedAdmin()
    expect(getUser).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('a new request gets a fresh answer', async () => {
    const { getAdminGate } = await load()
    await getAdminGate()
    requestHeaders = {}
    await getAdminGate()
    expect(getUser).toHaveBeenCalledTimes(2)
  })

  it('outside a request it still works, without a memo', async () => {
    requestHeaders = null
    const { getAdminGate } = await load()
    await getAdminGate()
    await getAdminGate()
    expect(getUser).toHaveBeenCalledTimes(2)
  })

  it('touches last_active_at only when stale', async () => {
    const { getAdminGate } = await load()
    await getAdminGate()
    expect(update).not.toHaveBeenCalled()

    requestHeaders = {}
    rpc.mockResolvedValue({ data: staffRow({ last_active_at: '2020-01-01T00:00:00Z' }), error: null })
    await getAdminGate()
    expect(update).toHaveBeenCalledTimes(1)
    expect(eq).toHaveBeenCalledWith('user_id', 'u1')
  })
})
