/**
 * Guard: listing view counting (migration 20261001181007).
 *
 * Why — 2026-10-01: every listing page logged "permission denied for table
 * listings" and no view was ever counted, because the counter UPDATEd
 * `listings` from the visitor's session after UPDATE was revoked from JWT
 * callers. Views now go through the service-role-only increment_listing_views:
 * it must bump both counters on an active listing, leave other listings alone,
 * and stay uncallable from a browser session (anon or signed in).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { makeFixture, URL, ANON, type Fixture } from './throwaway'

let fx: Fixture | null = null
/** An approved, active listing of the fixture seller (the fixture's own
 *  listing stays pending_approval). Namespaced title; removed with the seller. */
let activeId = ''

beforeAll(async () => {
  fx = await makeFixture()
  const { data: base } = await fx.svc.from('listings').select('game_id, game_category_id').eq('id', fx.listingId).single()
  const { data, error } = await fx.svc
    .from('listings')
    .insert({
      seller_id: fx.seller.id,
      game_id: (base as any).game_id,
      game_category_id: (base as any).game_category_id,
      title: fx.ns.listingTitle(),
      description: 'guard test throwaway',
      price: 1,
      quantity: 5,
      status: 'active',
      approved_by: fx.admin.id,
      approved_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(`active listing insert: ${error.message}`)
  activeId = (data as { id: string }).id
}, 120_000)

afterAll(async () => {
  await fx?.cleanup()
}, 120_000)

async function counts(id = activeId) {
  const { data, error } = await fx!.svc.from('listings').select('views, view_count').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data as { views: number | null; view_count: number | null }
}

const bump = (
  client: { rpc: (fn: string, args: object) => PromiseLike<{ error: { code?: string; message: string } | null }> },
  id = activeId,
) => client.rpc('increment_listing_views', { listing_uuid: id })

describe('increment_listing_views', () => {
  it('does not count a listing that is not active', async () => {
    const before = await counts(fx!.listingId) // the fixture listing is pending_approval
    expect((await bump(fx!.svc, fx!.listingId)).error).toBeNull()
    expect(await counts(fx!.listingId)).toEqual(before)
  })

  it('bumps views and view_count together on an active listing', async () => {
    const { data: row } = await fx!.svc.from('listings').select('status').eq('id', activeId).single()
    expect((row as { status: string }).status).toBe('active')
    const before = await counts()
    expect((await bump(fx!.svc)).error).toBeNull()
    const after = await counts()
    expect(after.views).toBe((before.views ?? 0) + 1)
    expect(after.view_count).toBe((before.view_count ?? 0) + 1)
  })

  it('is not callable from a browser session — signed in or anonymous', async () => {
    const before = await counts()
    const signedIn = await bump(fx!.buyer.client)
    expect(signedIn.error, 'a buyer session must not be able to bump views').not.toBeNull()

    const anon = createClient(URL!, ANON!, {
      auth: { persistSession: false },
    })
    expect((await bump(anon)).error, 'anon must not be able to bump views').not.toBeNull()
    expect(await counts()).toEqual(before)
  })

  it('visitors still cannot write the counters directly', async () => {
    const res = await fx!.buyer.client.from('listings').update({ views: 999_999 }).eq('id', activeId).select('id')
    expect(res.error !== null || (res.data ?? []).length === 0).toBe(true)
    expect((await counts()).views).not.toBe(999_999)
  })
})
