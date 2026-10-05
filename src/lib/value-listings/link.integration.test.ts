/**
 * The ONE listing → value item link function, against the local stack:
 * create/edit paths call `linkListingsToValueItems`, the nightly job calls
 * `reconcileValueRefs`. A failure is reported, never thrown (a failed link
 * must not block a publish).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from '@/test/guards/throwaway'
import { linkListingsToValueItems, reconcileValueRefs } from './link'

let fx: Fixture | null = null
let gameId = ''
let pairId = ''
let petSlug = ''
let petName = ''

async function insertListing(title: string, template: Record<string, unknown> = {}) {
  const { data, error } = await fx!.svc
    .from('listings')
    .insert({
      seller_id: fx!.seller.id, game_id: gameId, game_category_id: pairId, title, description: 'link test',
      price: 3, quantity: 1, status: 'draft', template_data: template,
    })
    .select('id')
    .single()
  expect(error).toBeNull()
  return (data as { id: string }).id
}

async function refOf(id: string) {
  const { data } = await fx!.svc.from('listings').select('value_item_slug, value_variant, value_matched_at').eq('id', id).single()
  return data as { value_item_slug: string | null; value_variant: string | null; value_matched_at: string | null }
}

describe.skipIf(!hasEnv)('linkListingsToValueItems (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    const { data: game } = await fx.svc.from('games').select('id').eq('slug', 'adopt-me').single()
    gameId = (game as { id: string }).id
    const { data: pair } = await fx.svc.from('game_categories').select('id').eq('game_id', gameId).eq('slug', 'buy-items').single()
    pairId = (pair as { id: string }).id
    const key = fx.ns.listingTitle().replace(/[^a-z0-9]/gi, '').toLowerCase()
    petSlug = `guard-pet-${key}`
    petName = `Guardpet ${key}`
    const { error } = await fx.svc.from('adopt_me_pets').insert({ slug: petSlug, name: petName, rarity: 'legendary' })
    expect(error).toBeNull()
  }, 60_000)

  afterAll(async () => {
    await fx?.svc.from('listings').delete().eq('seller_id', fx!.seller.id)
    await fx?.svc.from('adopt_me_pets').delete().eq('slug', petSlug)
    await fx?.cleanup()
  }, 60_000)

  it('links a listing to its item and variant', async () => {
    const id = await insertListing(`${fx!.ns.listingTitle()} | NFR ${petName}`)
    const out = await linkListingsToValueItems(fx!.svc, [id])
    expect(out.linked).toBe(1)
    expect(await refOf(id)).toMatchObject({ value_item_slug: petSlug, value_variant: 'neon-fly-ride' })
  })

  it('reads the item from the template when the title does not name it', async () => {
    const id = await insertListing(`${fx!.ns.listingTitle()} cheap pet`, { 'pet-name': petSlug })
    await linkListingsToValueItems(fx!.svc, [id])
    expect((await refOf(id)).value_item_slug).toBe(petSlug)
  })

  it('marks an unmatched listing as checked and reports it', async () => {
    const id = await insertListing(`${fx!.ns.listingTitle()} mystery box`)
    const out = await linkListingsToValueItems(fx!.svc, [id])
    expect(out.unmatched.map((u) => u.id)).toContain(id)
    const ref = await refOf(id)
    expect(ref.value_item_slug).toBeNull()
    expect(ref.value_matched_at).not.toBeNull()
  })

  it('reconcile picks up listings whose link was cleared by an edit', async () => {
    const id = await insertListing(`${fx!.ns.listingTitle()} | Neon ${petName}`)
    await linkListingsToValueItems(fx!.svc, [id])
    await fx!.svc.from('listings').update({ title: `${fx!.ns.listingTitle()} | Mega Neon ${petName}` }).eq('id', id)
    expect((await refOf(id)).value_matched_at).toBeNull()
    await reconcileValueRefs(fx!.svc, { limit: 500 })
    expect(await refOf(id)).toMatchObject({ value_item_slug: petSlug, value_variant: 'mega-neon' })
  })

  it('never throws: a broken client is reported, not raised', async () => {
    const broken = { from: () => { throw new Error('db down') } }
    const out = await linkListingsToValueItems(broken, ['00000000-0000-0000-0000-000000000000'])
    expect(out.errors.join(' ')).toContain('db down')
  })
})
