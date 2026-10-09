/**
 * Open seller signup — the offers-table edit paths honour the >$100 review
 * rule for an unverified seller (security review 2026-10-08): inline price
 * edit, bulk edit and draft→activate on admin-approved rows all land in
 * pending_approval, and the action reports that status back.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture } from '@/test/guards/throwaway'
import { UNVERIFIED_REVIEW_PRICE_USD } from '@/lib/fees'

// Real DB round trips on a shared laptop: the 5 s default is too tight.
vi.setConfig({ testTimeout: 30_000 })

let fx: Fixture | null = null
const tag = Math.random().toString(36).slice(2, 8)
let gameId = ''
let catId = ''

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!fx) throw new Error('fixture not ready')
    return fx.seller.client
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/seo/indexnow', () => ({ snapshotListings: async () => null, submitListingChanges: async () => undefined }))
vi.mock('@/lib/revalidation/listings', () => ({ revalidateListingSurfaces: async () => undefined }))
vi.mock('@/lib/value-listings/link', () => ({ linkListingsToValueItems: async () => undefined }))

const OVER = UNVERIFIED_REVIEW_PRICE_USD * 50

async function mk(name: string, price: number): Promise<string> {
  const title = `OSS-act-${tag} ${name}`
  const { error } = await fx!.svc.from('listings').insert({
    seller_id: fx!.seller.id, game_id: gameId, category_id: catId, title, description: 'guard test', price, quantity: 1, status: 'active',
  } as any)
  if (error) throw new Error(error.message)
  const { data } = await fx!.svc.from('listings').select('id').eq('title', title).single()
  return (data as any).id
}
async function approved(name: string): Promise<string> {
  const id = await mk(name, 150)
  const { error } = await fx!.svc.rpc('approve_listing' as any, { listing_id: id, admin_id: fx!.admin.id })
  if (error) throw new Error(error.message)
  return id
}
async function row(id: string) {
  return (await fx!.svc.from('listings').select('status, approved_by, price').eq('id', id).single()).data as any
}

describe.skipIf(!hasEnv)('offers-table edits respect the unverified >$100 review rule (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    const { data: l } = await fx.svc.from('listings').select('game_id, category_id').eq('id', fx.listingId).single()
    gameId = (l as any).game_id; catId = (l as any).category_id
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    await fx.svc.from('profiles').update({ is_verified: false }).eq('id', fx.seller.id)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    await fx.svc.from('listings').delete().like('title', `OSS-act-${tag}%`)
    await fx.cleanup()
  }, 60_000)

  it('updateListingPrice on an approved row → pending_approval, approval voided', async () => {
    const { updateListingPrice } = await import('@/lib/actions/listings')
    const id = await approved('inline')
    expect(await row(id)).toMatchObject({ status: 'active', approved_by: fx!.admin.id })
    const res = await updateListingPrice(id, OVER)
    expect(res.success, res.error).toBe(true)
    expect(await row(id)).toMatchObject({ status: 'pending_approval', approved_by: null, price: OVER })
  })

  it('updateListing reports pending_approval back to the caller', async () => {
    const { updateListing } = await import('@/lib/actions/listings')
    const id = await approved('inline-2')
    const res = await updateListing(id, { price: OVER })
    expect(res.success, res.error).toBe(true)
    expect(res.listing?.status).toBe('pending_approval')
  })

  it('bulkUpdateListings re-pricing two approved rows → both held', async () => {
    const { bulkUpdateListings } = await import('@/lib/actions/listings')
    const a = await approved('bulk-a'); const b = await approved('bulk-b')
    const res = await bulkUpdateListings([a, b], { price: OVER })
    expect(res.success, res.error).toBe(true)
    expect(res.updated).toBe(2)
    expect((await row(a)).status).toBe('pending_approval')
    expect((await row(b)).status).toBe('pending_approval')
  })

  it('draft re-priced over the line, then activated from the offers table → held', async () => {
    const { updateListing } = await import('@/lib/actions/listings')
    const id = await approved('draft')
    // the wizard saved it as a draft at the new price
    await fx!.svc.from('listings').update({ status: 'draft', price: OVER } as any).eq('id', id)
    expect(await row(id)).toMatchObject({ status: 'draft', approved_by: null })
    const res = await updateListing(id, { status: 'active' })
    expect(res.success, res.error).toBe(true)
    expect(res.listing?.status).toBe('pending_approval')
    expect((await row(id)).status).toBe('pending_approval')
  })

  it('bulk unpause without a price change keeps the approval and goes live', async () => {
    const { bulkUpdateListings, updateListing } = await import('@/lib/actions/listings')
    const id = await approved('unpause')
    expect((await updateListing(id, { status: 'paused' })).success).toBe(true)
    const res = await bulkUpdateListings([id], { status: 'active' })
    expect(res.success, res.error).toBe(true)
    expect(await row(id)).toMatchObject({ status: 'active', approved_by: fx!.admin.id })
  })

  it('a verified seller is untouched', async () => {
    const { updateListingPrice } = await import('@/lib/actions/listings')
    await fx!.svc.from('profiles').update({ is_verified: true }).eq('id', fx!.seller.id)
    try {
      const id = await approved('verified')
      const res = await updateListingPrice(id, OVER)
      expect(res.success, res.error).toBe(true)
      expect(await row(id)).toMatchObject({ status: 'active', approved_by: fx!.admin.id })
    } finally {
      await fx!.svc.from('profiles').update({ is_verified: false }).eq('id', fx!.seller.id)
    }
  })
})
