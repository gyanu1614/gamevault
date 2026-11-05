/**
 * What staff write about a listing never stays on a public row (integration).
 * Migration 20261104190126_listing_review_text.
 *
 * `listings` is readable with the public key and only row rules protect it, so on
 * 2026-11-04 anyone could read staff comments such as "Set a better price" on live
 * listings. Once a listing is active its review text is gone; the seller already has
 * it by email and the audit log keeps it.
 */
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { activateFixtureListing, ANON, assertGuardTargetAllowed, hasEnv, makeFixture, URL, type Fixture } from './throwaway'

let fx: Fixture | null = null
const anon = () => createClient(URL!, ANON!, { auth: { persistSession: false } })

vi.mock('server-only', () => ({}))

describe.skipIf(!hasEnv)('review text on listings (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env)
    fx = await makeFixture()
  }, 60_000)

  afterAll(async () => {
    if (fx) await fx.cleanup()
  }, 60_000)

  it('going live clears it, whichever path set the status', async () => {
    const { error: setError } = await fx!.svc.from('listings').update({ status: 'changes_requested', moderation_notes: 'Set a better price', rejection_reason: 'old reason' }).eq('id', fx!.listingId)
    expect(setError).toBeNull()

    await activateFixtureListing(fx!.svc, fx!.listingId, fx!.admin.id)

    const { data } = await fx!.svc.from('listings').select('status, moderation_notes, rejection_reason').eq('id', fx!.listingId).single()
    expect(data).toEqual({ status: 'active', moderation_notes: null, rejection_reason: null })
  })

  it('writing a note onto a live listing does not stick', async () => {
    await activateFixtureListing(fx!.svc, fx!.listingId, fx!.admin.id)
    await fx!.svc.from('listings').update({ moderation_notes: 'Good luck' }).eq('id', fx!.listingId)
    const { data } = await fx!.svc.from('listings').select('moderation_notes').eq('id', fx!.listingId).single()
    expect(data?.moderation_notes).toBeNull()
  })

  it('a sold listing restocked by a quantity change goes live with no old text', async () => {
    await fx!.svc.from('listings').update({ status: 'sold', moderation_notes: 'Old staff note', quantity: 0 }).eq('id', fx!.listingId)
    const { data: before } = await fx!.svc.from('listings').select('status, moderation_notes').eq('id', fx!.listingId).single()
    expect(before).toEqual({ status: 'sold', moderation_notes: 'Old staff note' })

    await fx!.svc.from('listings').update({ quantity: 5 }).eq('id', fx!.listingId)
    const { data } = await fx!.svc.from('listings').select('status, moderation_notes').eq('id', fx!.listingId).single()
    expect(data).toEqual({ status: 'active', moderation_notes: null })
  })

  it('the public key finds no text on any live listing', async () => {
    const { data, error } = await anon().from('listings').select('id, moderation_notes, rejection_reason').eq('status', 'active').or('moderation_notes.not.is.null,rejection_reason.not.is.null')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('the seller still reads the reason on their own refused listing', async () => {
    await fx!.svc.from('listings').update({ status: 'rejected', rejection_reason: 'Wrong game' }).eq('id', fx!.listingId)
    const { data } = await fx!.seller.client.from('listings').select('status, rejection_reason').eq('id', fx!.listingId).single()
    expect(data).toEqual({ status: 'rejected', rejection_reason: 'Wrong game' })
    const { data: stranger } = await anon().from('listings').select('id').eq('id', fx!.listingId)
    expect(stranger).toEqual([])
  })
})
