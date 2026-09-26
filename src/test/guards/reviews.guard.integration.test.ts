/**
 * AUTH-011 — reviews moderation columns are pinned at the database.
 * Exploit: the review author (whose 30-day edit policy only re-asserts
 * reviewer_id/created_at) clears flagged_for_moderation / moderation_reason on
 * a visible flagged review through PostgREST. (A HIDDEN review is already out
 * of the author's reach: the only non-admin SELECT policy is is_visible=true,
 * so PostgREST matches 0 rows — asserted below for the record.)
 * Positive: the author can still edit their comment; the service role (the
 * admin actions' client after the fix) can still moderate.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, p1GuardsApplied, makeFixture, expectGuardRejection, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false
let reviewId = ''

describe.skipIf(!hasEnv)('AUTH-011 — reviews moderation column guard (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = await p1GuardsApplied(fx.svc)
    const { data, error } = await fx.svc.from('reviews').insert({
      order_id: fx.completedOrderId, reviewer_id: fx.buyer.id, seller_id: fx.seller.id,
      listing_id: fx.listingId, rating: 1, comment: 'guard test — flagged by admin',
      is_visible: true, flagged_for_moderation: true, moderation_reason: 'abusive',
    }).select('id').single()
    if (error) throw new Error(`review insert: ${error.message}`)
    reviewId = (data as any).id
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('20260912100000_auth_p1.sql is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  it('the author cannot clear the moderation flag / reason on their visible flagged review', async () => {
    const res = await fx!.buyer.client.from('reviews')
      .update({ flagged_for_moderation: false, moderation_reason: null })
      .eq('id', reviewId).select('id')
    expectGuardRejection(res as any, 'reviews')
    const { data } = await fx!.svc.from('reviews').select('is_visible,flagged_for_moderation,moderation_reason').eq('id', reviewId).single()
    expect(data).toMatchObject({ is_visible: true, flagged_for_moderation: true, moderation_reason: 'abusive' })
  })

  it('the author cannot hide/unhide their own review either', async () => {
    const res = await fx!.buyer.client.from('reviews').update({ is_visible: false }).eq('id', reviewId).select('id')
    expectGuardRejection(res as any, 'reviews')
    // once hidden by an admin, the row is not even reachable to the author (SELECT policy)
    await fx!.svc.from('reviews').update({ is_visible: false }).eq('id', reviewId)
    const back = await fx!.buyer.client.from('reviews').update({ is_visible: true }).eq('id', reviewId).select('id')
    if (!back.error) expect(back.data ?? []).toHaveLength(0)
    const { data } = await fx!.svc.from('reviews').select('is_visible').eq('id', reviewId).single()
    expect((data as any).is_visible).toBe(false)
    await fx!.svc.from('reviews').update({ is_visible: true }).eq('id', reviewId)
  })

  it('the author can still edit the comment text', async () => {
    const { error } = await fx!.buyer.client.from('reviews')
      .update({ comment: 'edited by author', last_edited_at: new Date().toISOString() })
      .eq('id', reviewId)
    expect(error).toBeNull()
  })

  it('the service role can still moderate (admin actions write through it)', async () => {
    const { error } = await fx!.svc.from('reviews')
      .update({ is_visible: true, flagged_for_moderation: false, moderation_reason: null })
      .eq('id', reviewId)
    expect(error).toBeNull()
  })
})
