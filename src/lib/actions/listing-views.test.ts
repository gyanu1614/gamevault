import { describe, it, expect, vi, beforeEach } from 'vitest'

const LISTING = '11111111-2222-4333-8444-555555555555'
const SELLER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

const state = {
  user: null as null | { id: string },
  sellerId: SELLER,
  limited: false,
  rpcError: null as null | { message: string },
}
const rpc = vi.fn(async () => ({ error: state.rpcError }))
const checkRateLimit = vi.fn(async () => ({ limited: state.limited, retryAfter: 1, key: 'k' }))

vi.mock('next/headers', () => ({
  headers: () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { seller_id: state.sellerId } }) }) }),
    }),
    rpc,
  }),
}))
vi.mock('@/lib/security/rate-limit', async (orig) => ({
  ...(await orig<typeof import('@/lib/security/rate-limit')>()),
  checkRateLimit,
}))

const { trackListingView } = await import('./listing-views')

beforeEach(() => {
  state.user = null
  state.limited = false
  state.rpcError = null
  rpc.mockClear()
  checkRateLimit.mockClear()
})

describe('trackListingView', () => {
  it('counts a visitor’s view through the service-role RPC', async () => {
    await expect(trackListingView(LISTING)).resolves.toEqual({ success: true, counted: true })
    expect(rpc).toHaveBeenCalledWith('increment_listing_views', { listing_uuid: LISTING })
    expect(checkRateLimit).toHaveBeenCalledWith('listingView', `${LISTING}:ip:203.0.113.7`)
  })

  it('counts a signed-in buyer', async () => {
    state.user = { id: 'someone-else' }
    await expect(trackListingView(LISTING)).resolves.toEqual({ success: true, counted: true })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('skips the seller opening their own listing', async () => {
    state.user = { id: SELLER }
    await expect(trackListingView(LISTING)).resolves.toEqual({ success: true, counted: false })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('counts a visitor once per window (reloads do not pump views)', async () => {
    state.limited = true
    await expect(trackListingView(LISTING)).resolves.toEqual({ success: true, counted: false })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects anything that is not a listing id before touching the database', async () => {
    await expect(trackListingView("1' or 1=1")).resolves.toEqual({ success: false, error: 'Invalid listing' })
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('reports a database error without throwing', async () => {
    state.rpcError = { message: 'boom' }
    await expect(trackListingView(LISTING)).resolves.toEqual({ success: false, error: 'boom' })
  })
})
