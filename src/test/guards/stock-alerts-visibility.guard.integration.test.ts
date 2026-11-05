/**
 * Notify Me's visibility rule against the local stack, with the real listing,
 * presence and profile reads: the Frost Fury case (2026-11-04), where the only
 * live listing was from a paused store and the buyer was told it was listed.
 * Only Next's cache is stubbed, because it needs a running server.
 *
 * Rows: the fixture's listing and users, removed by fx.cleanup().
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { hasEnv, makeFixture, activateFixtureListing, type Fixture } from './throwaway'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: () => {},
  revalidatePath: () => {},
}))
// The cached list is exactly what the rule doesn't use; its module needs a server.
vi.mock('@/lib/seo/hidden-sellers', () => ({ getHiddenSellerIds: async () => [] }))

import { itemHasVisibleOffer } from '@/lib/stock-alerts/visible-offer'

let fx: Fixture | null = null
let gameSlug = ''
let item = ''

describe.skipIf(!hasEnv)('Notify Me counts only what the site shows (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    item = `guard-offer-${fx.ns.tag}`
    await activateFixtureListing(fx.svc, fx.listingId, fx.admin.id, { value_item_slug: item, value_variant: 'fly-ride' })
    const { data, error } = await fx.svc.from('listings').select('status, game:games!listings_game_id_fkey(slug)').eq('id', fx.listingId).single()
    if (error) throw new Error(error.message)
    const row = data as unknown as { status: string; game: { slug: string } }
    expect(row.status).toBe('active')
    gameSlug = row.game.slug
    const up = await fx.svc.from('seller_presence').upsert({ seller_id: fx.seller.id, store_paused: false }, { onConflict: 'seller_id' })
    if (up.error) throw new Error(up.error.message)
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  const setPaused = async (paused: boolean) => {
    const { error } = await fx!.svc.from('seller_presence').update({ store_paused: paused }).eq('seller_id', fx!.seller.id)
    if (error) throw new Error(error.message)
  }

  it('an ordinary seller: listed, for any trait and for that trait, not for another trait or item', async () => {
    expect(await itemHasVisibleOffer(gameSlug, item, null)).toBe(true)
    expect(await itemHasVisibleOffer(gameSlug, item, 'fly-ride')).toBe(true)
    expect(await itemHasVisibleOffer(gameSlug, item, 'neon-fly-ride')).toBe(false)
    expect(await itemHasVisibleOffer(gameSlug, `${item}-other`, null)).toBe(false)
  })

  it('the only listing is from a paused store: not listed, and listed again the moment the store is back', async () => {
    await setPaused(true)
    expect(await itemHasVisibleOffer(gameSlug, item, null)).toBe(false)
    expect(await itemHasVisibleOffer(gameSlug, item, 'fly-ride')).toBe(false)
    await setPaused(false)
    expect(await itemHasVisibleOffer(gameSlug, item, null)).toBe(true)
  })

  it("a test account's listing is not listed", async () => {
    const off = await fx!.svc.from('profiles').update({ is_test: true }).eq('id', fx!.seller.id)
    if (off.error) throw new Error(off.error.message)
    expect(await itemHasVisibleOffer(gameSlug, item, null)).toBe(false)
    const on = await fx!.svc.from('profiles').update({ is_test: false }).eq('id', fx!.seller.id)
    if (on.error) throw new Error(on.error.message)
    expect(await itemHasVisibleOffer(gameSlug, item, null)).toBe(true)
  })
})
