/**
 * Staff can find any listing and act on it (integration). The audit on 2026-11-04
 * found Take Down reachable only from a seller's 8 newest listings or an upheld
 * report, so a known bad listing could not be reached. Migration
 * *_admin_listings_page.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { activateFixtureListing, assertGuardTargetAllowed, hasEnv, makeFixture, type Fixture } from './throwaway'

const gateState = vi.hoisted(() => ({ role: 'moderator' as string }))

vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/actions/admin-permissions', () => ({
  requireRole: vi.fn(async (roles: string[]) => {
    if (!roles.includes(gateState.role)) throw new Error(`Role not allowed: ${gateState.role}`)
    return { id: 'staff', role: gateState.role }
  }),
}))

import { getAdminListings } from '@/lib/actions/admin-listings'

let fx: Fixture | null = null
let title = ''
let shopName = ''

describe.skipIf(!hasEnv)('admin listing search (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env)
    fx = await makeFixture()
    const tag = fx.ns.key.replace(/[^a-z0-9]/gi, '').slice(-8)
    title = `Rare Findable Pet ${tag}`
    shopName = `gtshop${tag}`.slice(0, 20)
    // Title first: editing a listing can send it back for review.
    await fx.svc.from('listings').update({ title }).eq('id', fx.listingId)
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id)
    await fx.svc.from('profiles').update({ shop_name: shopName }).eq('id', fx.seller.id)
  }, 60_000)

  afterAll(async () => {
    if (fx) await fx.cleanup()
  }, 60_000)

  it('finds a listing by words in its title, ignoring case', async () => {
    const result = await getAdminListings({ q: title.toLowerCase().slice(5, 20) })
    expect(result.rows.map((r) => r.id)).toContain(fx!.listingId)
  })

  it('finds a listing by its seller store name', async () => {
    const result = await getAdminListings({ q: shopName })
    expect(result.rows.map((r) => r.id)).toContain(fx!.listingId)
  })

  it('finds a listing by its exact id', async () => {
    const result = await getAdminListings({ q: fx!.listingId })
    expect(result.rows.map((r) => r.id)).toEqual([fx!.listingId])
  })

  it('treats search text as text, not as a pattern', async () => {
    const result = await getAdminListings({ q: '%' })
    expect(result.rows.map((r) => r.id)).not.toContain(fx!.listingId)
  })

  it('filters by status', async () => {
    const live = await getAdminListings({ q: shopName, status: 'active' })
    expect(live.rows.map((r) => r.id)).toContain(fx!.listingId)
    const down = await getAdminListings({ q: shopName, status: 'suspended' })
    expect(down.rows).toEqual([])
  })

  it('returns what the row needs and no private seller details', async () => {
    const result = await getAdminListings({ q: fx!.listingId })
    const row = result.rows[0]!
    expect(row).toMatchObject({ title, status: 'active', seller: { id: fx!.seller.id, name: shopName } })
    expect(JSON.stringify(row)).not.toMatch(/@example\.com/)
    expect(result.total).toBe(1)
  })

  it('shows staff the take-down reason on a suspended listing', async () => {
    await fx!.svc.from('listings').update({ status: 'suspended', moderation_notes: 'Taken down: No offsite trading' }).eq('id', fx!.listingId)
    const result = await getAdminListings({ q: fx!.listingId })
    expect(result.rows[0]?.note).toBe('Taken down: No offsite trading')
    await activateFixtureListing(fx!.svc, fx!.listingId, fx!.admin.id)
  })

  it('support staff cannot use it', async () => {
    gateState.role = 'support'
    await expect(getAdminListings({})).rejects.toThrow(/Role not allowed/)
    gateState.role = 'moderator'
  })

  it('a signed-in member and the public key cannot call the database function', async () => {
    const args = { p_q: null, p_id: null, p_status: null, p_limit: 5, p_page: 1 }
    const { error } = await fx!.buyer.client.rpc('admin_listings_page', args)
    expect(error?.code).toBe('42501')
  })
})
