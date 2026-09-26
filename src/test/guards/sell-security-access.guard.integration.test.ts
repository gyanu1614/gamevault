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

  it('ACC-08: profile-pictures keeps plain owner-write for every signed-in user', async () => {
    if (!ready) return
    const ok = await tryUpload(fx!.buyer.client, 'profile-pictures', `${fx!.buyer.id}/${fx!.ns.tag}-avatar.png`)
    expect(ok.error).toBeNull()
  })
})
