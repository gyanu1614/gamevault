/**
 * /sell security — Part 3 (ACC-08 storage half) and Part 5 (GRO-08 DB half).
 *
 *   ACC-08 · listing-images: a signed-in user with no sell access cannot put
 *            an object under their own prefix; a seller can. profile-pictures
 *            keeps plain owner-write.
 *   GRO-08 · an applicant (application pending) is 'applicant' to
 *            sell_access_kind, may INSERT a draft, and can neither insert nor
 *            be moved to any non-draft status — by RLS and by the trigger,
 *            for every caller.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const uploaded: Array<[string, string]> = []

async function tryUpload(client: Fixture['seller']['client'], bucket: string, path: string) {
  const res = await client.storage.from(bucket).upload(path, PNG, { contentType: 'image/png', upsert: false })
  if (!res.error) uploaded.push([bucket, path])
  return res
}

describe.skipIf(!hasEnv)('sell security — sell access on storage (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('sell_security_version')).error
  }, 60_000)
  afterAll(async () => {
    for (const [bucket, path] of uploaded) await fx!.svc.storage.from(bucket).remove([path])
    await fx?.cleanup()
  }, 60_000)

  it('the migration is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  it('ACC-08: a buyer cannot write listing-images even under their own prefix; a seller can', async () => {
    if (!ready) return
    const denied = await tryUpload(fx!.buyer.client, 'listing-images', `${fx!.buyer.id}/${fx!.ns.tag}-buyer.png`)
    expect(denied.error).not.toBeNull()
    const ok = await tryUpload(fx!.seller.client, 'listing-images', `${fx!.seller.id}/${fx!.ns.tag}-seller.png`)
    expect(ok.error).toBeNull()
    // the owner prefix still binds the seller
    const foreign = await tryUpload(fx!.seller.client, 'listing-images', `${fx!.buyer.id}/${fx!.ns.tag}-x.png`)
    expect(foreign.error).not.toBeNull()
  })

  describe('GRO-08 — an applicant may build drafts, and only drafts', () => {
    let appId = ''
    let gameId = ''
    let pairId = ''
    beforeAll(async () => {
      if (!ready) return
      const { data, error } = await fx!.svc.from('seller_applications').insert({
        user_id: fx!.buyer.id, status: 'pending', is_18_or_older: true, seller_type: 'individual',
        display_name: 'Guard Applicant', submitted_at: new Date().toISOString(),
      }).select('id').single()
      if (error) throw new Error(`application insert: ${error.message}`)
      appId = (data as any).id
      const { data: l } = await fx!.svc.from('listings').select('game_id, game_category_id').eq('id', fx!.listingId).single()
      gameId = (l as any).game_id; pairId = (l as any).game_category_id
    })
    afterAll(async () => {
      if (appId) await fx!.svc.from('seller_applications').delete().eq('id', appId)
    })
    const row = (status: string) => ({
      seller_id: fx!.buyer.id, game_id: gameId, game_category_id: pairId,
      title: fx!.ns.listingTitle(), description: 'applicant draft', price: 1, quantity: 1, status,
    })

    it('a pending application makes the account an applicant', async () => {
      if (!ready) return
      const { data } = await fx!.buyer.client.rpc('sell_access_kind', { p_user: fx!.buyer.id })
      expect(data).toBe('applicant')
    })

    it('the applicant can INSERT a draft through PostgREST, but no other status', async () => {
      if (!ready) return
      const draft = await fx!.buyer.client.from('listings').insert(row('draft')).select('id, status').single()
      expect(draft.error).toBeNull()
      expect((draft.data as any).status).toBe('draft')
      for (const status of ['active', 'pending_approval', 'paused']) {
        const res = await fx!.buyer.client.from('listings').insert(row(status)).select('id')
        expect(res.error, status).not.toBeNull()
      }
    })

    it("an applicant's draft cannot be moved to any non-draft status by ANY caller (trigger)", async () => {
      if (!ready) return
      const { data, error } = await fx!.svc.from('listings').insert(row('draft')).select('id').single()
      expect(error).toBeNull()
      const id = (data as any).id as string
      for (const status of ['active', 'pending_approval', 'paused']) {
        const res = await fx!.svc.from('listings').update({ status }).eq('id', id).select('id')
        expect(res.error?.code, status).toBe('42501')
      }
      const ins = await fx!.svc.from('listings').insert(row('pending_approval')).select('id')
      expect(ins.error?.code).toBe('42501')
      // editing the draft's content stays possible
      expect((await fx!.svc.from('listings').update({ price: 2 }).eq('id', id)).error).toBeNull()
    })

    it('an applicant can upload listing images under their own prefix (drafts need images)', async () => {
      if (!ready) return
      const ok = await tryUpload(fx!.buyer.client, 'listing-images', `${fx!.buyer.id}/${fx!.ns.tag}-applicant.png`)
      expect(ok.error).toBeNull()
    })
  })

  it('ACC-08: profile-pictures keeps plain owner-write for every signed-in user', async () => {
    if (!ready) return
    const ok = await tryUpload(fx!.buyer.client, 'profile-pictures', `${fx!.buyer.id}/${fx!.ns.tag}-avatar.png`)
    expect(ok.error).toBeNull()
  })
})
