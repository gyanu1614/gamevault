/**
 * AUTH-031 — a seller cannot INSERT a pre-approved / live listing.
 * Exploit: `check_listing_moderation` short-circuits when NEW.approved_by is
 * set, and the AUTH-006 guard only covered UPDATE, so
 * `INSERT listings (status='active', approved_by=<self>, approved_at=now())`
 * went live with zero moderation. Now every non-guarded INSERT has its
 * moderation columns forced NULL and an 'active' status coerced to
 * 'pending_approval'. The app publishes through the service role after its
 * own seller gate + policy decision, so auto-approve tiers keep working.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, p1GuardsApplied, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false
let gameId = ''
let catId = ''
const tag = Math.random().toString(36).slice(2, 8)

async function insertAs(client: any, sellerId: string, title: string, extra: Record<string, unknown>) {
  return client.from('listings').insert({
    seller_id: sellerId, game_id: gameId, category_id: catId, title, description: 'guard test', price: 1, quantity: 1, ...extra,
  })
}
async function rowByTitle(title: string) {
  const { data } = await fx!.svc.from('listings')
    .select('status, approved_by, approved_at, rejected_by, moderation_notes').eq('title', title).maybeSingle()
  return data as any
}

describe.skipIf(!hasEnv)('AUTH-031 — listings INSERT moderation guard (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = await p1GuardsApplied(fx.svc)
    const { data: l } = await fx.svc.from('listings').select('game_id, category_id').eq('id', fx.listingId).single()
    gameId = (l as any).game_id; catId = (l as any).category_id
    // seller past the entry tier: no pre-moderation applies, so only the guard can stop it
    await fx.svc.from('profiles').update({ role: 'seller', seller_tier: 'ruby' }).eq('id', fx.seller.id)
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('20260912100000_auth_p1.sql is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  it('a seller inserting a self-approved active listing gets an unapproved pending_approval row', async () => {
    const title = `AUTH-031 self-approved ${tag}`
    const res = await insertAs(fx!.seller.client, fx!.seller.id, title, {
      status: 'active', approved_by: fx!.seller.id, approved_at: new Date().toISOString(), moderation_notes: 'lgtm',
    })
    expect(res.error).toBeNull() // coerced, not rejected
    const row = await rowByTitle(title)
    expect(row.status).toBe('pending_approval')
    expect(row.approved_by).toBeNull()
    expect(row.approved_at).toBeNull()
    expect(row.moderation_notes).toBeNull()
  })

  it("a seller's plain 'active' insert is also held for moderation", async () => {
    const title = `AUTH-031 plain active ${tag}`
    const res = await insertAs(fx!.seller.client, fx!.seller.id, title, { status: 'active' })
    expect(res.error).toBeNull()
    expect((await rowByTitle(title)).status).toBe('pending_approval')
  })

  it('a seller can still save a draft', async () => {
    const title = `AUTH-031 draft ${tag}`
    const res = await insertAs(fx!.seller.client, fx!.seller.id, title, { status: 'draft' })
    expect(res.error).toBeNull()
    expect((await rowByTitle(title)).status).toBe('draft')
  })

  it('the service role (the app publish path) can still insert an approved active listing', async () => {
    const title = `AUTH-031 service ${tag}`
    const res = await insertAs(fx!.svc, fx!.seller.id, title, {
      status: 'active', approved_by: fx!.admin.id, approved_at: new Date().toISOString(),
    })
    expect(res.error).toBeNull()
    const row = await rowByTitle(title)
    expect(row.status).toBe('active')
    expect(row.approved_by).toBe(fx!.admin.id)
  })
})
