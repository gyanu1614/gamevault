/**
 * Notify Me (migrations 20261104130856 + 20261104130857): stock_alerts is
 * service-role only, the listings trigger marks an item's open alerts due when
 * a listing of it goes live — an any-trait alert for every listing, a trait
 * alert only for a listing of that trait — and stock_alerts_claim_due hands
 * each due alert to exactly one dispatcher, once.
 *
 * Rows: the alerts belong to the fixture users (stock_alerts is in
 * DEPENDENT_TABLES, and its user FK cascades), so fx.cleanup() removes them.
 * A claim may pick up due rows this file did not create; those are put back
 * (notified_at = null) right after, so no other row is left changed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, activateFixtureListing, URL, ANON, type Fixture } from './throwaway'

type Alert = { id: string; user_id: string; item_slug: string; variant: string | null; due_at: string | null; notified_at: string | null }
type Claimed = { id: string; user_id: string; game_id: string; item_slug: string; variant: string | null }

let fx: Fixture | null = null
let gameId = ''
let itemSlug = ''
let otherSlug = ''

async function alerts(): Promise<Alert[]> {
  const { data, error } = await fx!.svc
    .from('stock_alerts')
    .select('id, user_id, item_slug, variant, due_at, notified_at')
    .in('user_id', [fx!.buyer.id, fx!.seller.id])
  if (error) throw new Error(error.message)
  return (data ?? []) as Alert[]
}

async function claim(limit: number): Promise<Claimed[]> {
  const { data, error } = await fx!.svc.rpc('stock_alerts_claim_due', { p_limit: limit })
  if (error) throw new Error(`stock_alerts_claim_due: ${error.message}`)
  return (data ?? []) as Claimed[]
}

describe.skipIf(!hasEnv)('stock alerts — posture, trigger, claim (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    const { data: l } = await fx.svc.from('listings').select('game_id').eq('id', fx.listingId).single()
    gameId = (l as { game_id: string }).game_id
    itemSlug = `guard-item-${fx.ns.tag}`
    otherSlug = `guard-other-${fx.ns.tag}`
    const { error } = await fx.svc.from('stock_alerts').insert([
      { user_id: fx.buyer.id, game_id: gameId, item_slug: itemSlug },
      { user_id: fx.buyer.id, game_id: gameId, item_slug: itemSlug, variant: 'fly-ride' },
      { user_id: fx.buyer.id, game_id: gameId, item_slug: itemSlug, variant: 'neon-fly-ride' },
      { user_id: fx.seller.id, game_id: gameId, item_slug: otherSlug },
    ])
    if (error) throw new Error(`stock_alerts insert: ${error.message}`)
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('a signed-in user cannot read or write stock_alerts directly', async () => {
    const read = await fx!.buyer.client.from('stock_alerts').select('id')
    expect(read.error, 'select must be refused').not.toBeNull()
    expect(read.error!.code).toBe('42501')
    const write = await fx!.buyer.client.from('stock_alerts').insert({ user_id: fx!.buyer.id, game_id: gameId, item_slug: 'x' })
    expect(write.error, 'insert must be refused').not.toBeNull()
    expect(write.error!.code).toBe('42501')
  })

  it('neither anon nor a signed-in user can claim alerts', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } })
    for (const client of [anon, fx!.buyer.client]) {
      const { error } = await client.rpc('stock_alerts_claim_due', { p_limit: 1 })
      expect(error, 'claim must be refused').not.toBeNull()
      expect(error!.code).toBe('42501')
    }
  })

  it('rejects an item slug outside the slug shape', async () => {
    const { error } = await fx!.svc.from('stock_alerts').insert({ user_id: fx!.buyer.id, game_id: gameId, item_slug: 'Bad Slug!' })
    expect(error).not.toBeNull()
    expect(error!.code).toBe('23514')
  })

  it('one any-trait alert and one alert per trait; a second copy of either is refused', async () => {
    for (const variant of [null, 'fly-ride']) {
      const { error } = await fx!.svc.from('stock_alerts').insert({ user_id: fx!.buyer.id, game_id: gameId, item_slug: itemSlug, variant })
      expect(error, `duplicate ${variant ?? 'any'} alert must be refused`).not.toBeNull()
      expect(error!.code).toBe('23505')
    }
    const { error } = await fx!.svc.from('stock_alerts').insert({ user_id: fx!.buyer.id, game_id: gameId, item_slug: itemSlug, variant: 'Neon FR' })
    expect(error!.code).toBe('23514')
  })

  it('a live Fly Ride listing makes the item’s any-trait and Fly Ride alerts due, not Neon Fly Ride or other items', async () => {
    expect((await alerts()).every((a) => a.due_at === null)).toBe(true)
    // Approve first (no item yet), then link: the "re-linked" path of the trigger.
    await activateFixtureListing(fx!.svc, fx!.listingId, fx!.admin.id, { value_item_slug: itemSlug, value_variant: 'fly-ride' })
    const rows = await alerts()
    const of = (variant: string | null) => rows.find((a) => a.item_slug === itemSlug && a.variant === variant)!
    expect(of(null).due_at).not.toBeNull()
    expect(of('fly-ride').due_at).not.toBeNull()
    expect(of('neon-fly-ride').due_at).toBeNull()
    expect(rows.find((a) => a.item_slug === otherSlug)!.due_at).toBeNull()
  })

  it('re-tagging the live listing to Neon Fly Ride makes that trait’s alert due', async () => {
    await fx!.svc.from('listings').update({ value_variant: 'neon-fly-ride' }).eq('id', fx!.listingId)
    const nfr = (await alerts()).find((a) => a.item_slug === itemSlug && a.variant === 'neon-fly-ride')!
    expect(nfr.due_at).not.toBeNull()
  })

  it('two concurrent claims hand each due alert to exactly one of them, once, with its trait', async () => {
    const mine = (await alerts()).filter((a) => a.item_slug === itemSlug)
    const [a, b] = await Promise.all([claim(500), claim(500)])
    const foreign = [...a, ...b].filter((c) => c.user_id !== fx!.buyer.id && c.user_id !== fx!.seller.id).map((c) => c.id)
    if (foreign.length) await fx!.svc.from('stock_alerts').update({ notified_at: null }).in('id', foreign)

    for (const m of mine) {
      const got = [...a, ...b].filter((c) => c.id === m.id)
      expect(got).toHaveLength(1)
      expect(got[0].variant).toBe(m.variant)
    }
    expect((await alerts()).filter((x) => x.item_slug === itemSlug).every((x) => x.notified_at !== null)).toBe(true)
    const again = await claim(500)
    expect(again.some((c) => mine.some((m) => m.id === c.id))).toBe(false)
  })

  it('re-linking the listing does not re-arm an alert that was already sent', async () => {
    const before = (await alerts()).find((a) => a.item_slug === itemSlug && a.variant === null)!
    await fx!.svc.from('listings').update({ value_item_slug: null }).eq('id', fx!.listingId)
    await fx!.svc.from('listings').update({ value_item_slug: itemSlug }).eq('id', fx!.listingId)
    const after = (await alerts()).find((a) => a.item_slug === itemSlug && a.variant === null)!
    expect(after.due_at).toBe(before.due_at)
    expect(after.notified_at).toBe(before.notified_at)
  })
})
