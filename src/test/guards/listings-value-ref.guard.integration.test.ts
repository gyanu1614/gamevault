/**
 * Bundle 2 — the stored listing → value item link (`value_item_slug`,
 * `value_variant`, `value_matched_at`).
 *
 * Only the backend sets it (the TS matcher, `linkListingsToValueItems`). The
 * trigger `trg_listings_value_ref` is the safety net:
 *   · an untrusted INSERT can't claim an item (a junk listing must not appear
 *     on the Bat Dragon page as "Buy From $1")
 *   · when the title / template / game / category changes, a stale link is
 *     cleared so the listing never shows on the wrong item page — unless the
 *     same trusted write sets a fresh link
 * A cleared link has `value_matched_at IS NULL`, which is what the nightly
 * reconcile job picks up.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let gameId = ''
let catId = ''
const tag = Math.random().toString(36).slice(2, 8)

const REF = 'value_item_slug, value_variant, value_matched_at'

async function insertAs(client: any, title: string, extra: Record<string, unknown> = {}) {
  const res = await client.from('listings').insert({
    seller_id: fx!.seller.id, game_id: gameId, category_id: catId, title, description: 'guard test',
    price: 1, quantity: 1, status: 'draft', ...extra,
  })
  expect(res.error).toBeNull()
  const { data } = await fx!.svc.from('listings').select(`id, ${REF}`).eq('title', title).single()
  return data as { id: string; value_item_slug: string | null; value_variant: string | null; value_matched_at: string | null }
}

async function refOf(id: string) {
  const { data } = await fx!.svc.from('listings').select(REF).eq('id', id).single()
  return data as { value_item_slug: string | null; value_variant: string | null; value_matched_at: string | null }
}

const linked = { value_item_slug: 'bat-dragon', value_variant: 'neon', value_matched_at: new Date().toISOString() }

describe.skipIf(!hasEnv)('listings value-item link guard (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    const { data: l } = await fx.svc.from('listings').select('game_id, category_id').eq('id', fx.listingId).single()
    gameId = (l as any).game_id
    catId = (l as any).category_id
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('a seller INSERT cannot set the link', async () => {
    const row = await insertAs(fx!.seller.client, `${fx!.ns.listingTitle()} VREF seller ${tag}`, linked)
    expect(row.value_item_slug).toBeNull()
    expect(row.value_variant).toBeNull()
    expect(row.value_matched_at).toBeNull()
  })

  it('the backend can set the link', async () => {
    const row = await insertAs(fx!.svc, `${fx!.ns.listingTitle()} VREF svc ${tag}`)
    const { error } = await fx!.svc.from('listings').update(linked).eq('id', row.id)
    expect(error).toBeNull()
    expect(await refOf(row.id)).toMatchObject({ value_item_slug: 'bat-dragon', value_variant: 'neon' })
  })

  it('a title change clears a stale link', async () => {
    const row = await insertAs(fx!.svc, `${fx!.ns.listingTitle()} VREF title ${tag}`)
    await fx!.svc.from('listings').update(linked).eq('id', row.id)
    await fx!.svc.from('listings').update({ title: `${fx!.ns.listingTitle()} VREF title changed ${tag}` }).eq('id', row.id)
    expect(await refOf(row.id)).toEqual({ value_item_slug: null, value_variant: null, value_matched_at: null })
  })

  it('a template change clears a stale link', async () => {
    const row = await insertAs(fx!.svc, `${fx!.ns.listingTitle()} VREF tmpl ${tag}`)
    await fx!.svc.from('listings').update(linked).eq('id', row.id)
    await fx!.svc.from('listings').update({ template_data: { 'pet-name': 'parrot' } }).eq('id', row.id)
    expect((await refOf(row.id)).value_matched_at).toBeNull()
  })

  it('a price-only change keeps the link', async () => {
    const row = await insertAs(fx!.svc, `${fx!.ns.listingTitle()} VREF price ${tag}`)
    await fx!.svc.from('listings').update(linked).eq('id', row.id)
    await fx!.svc.from('listings').update({ price: 2 }).eq('id', row.id)
    expect((await refOf(row.id)).value_item_slug).toBe('bat-dragon')
  })

  it('a trusted write that changes the title AND sets a fresh link keeps the fresh link', async () => {
    const row = await insertAs(fx!.svc, `${fx!.ns.listingTitle()} VREF both ${tag}`)
    await fx!.svc.from('listings').update(linked).eq('id', row.id)
    await fx!.svc
      .from('listings')
      .update({ title: `${fx!.ns.listingTitle()} VREF both changed ${tag}`, value_item_slug: 'parrot', value_variant: 'fly-ride', value_matched_at: new Date().toISOString() })
      .eq('id', row.id)
    expect(await refOf(row.id)).toMatchObject({ value_item_slug: 'parrot', value_variant: 'fly-ride' })
  })
})
