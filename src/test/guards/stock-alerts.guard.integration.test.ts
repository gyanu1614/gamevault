/**
 * Notify Me (migration 20261025014756): stock_alerts is service-role only,
 * the listings trigger marks an item's open alerts due when a listing of it
 * goes live, and stock_alerts_claim_due hands each due alert to exactly one
 * dispatcher, once.
 *
 * Rows: the alerts belong to the fixture users (stock_alerts is in
 * DEPENDENT_TABLES, and its user FK cascades), so fx.cleanup() removes them.
 * A claim may pick up due rows this file did not create; those are put back
 * (notified_at = null) right after, so no other row is left changed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, activateFixtureListing, URL, ANON, type Fixture } from './throwaway'

type Alert = { id: string; user_id: string; item_slug: string; due_at: string | null; notified_at: string | null }
type Claimed = { id: string; user_id: string; game_id: string; item_slug: string }

let fx: Fixture | null = null
let gameId = ''
let itemSlug = ''
let otherSlug = ''

async function alerts(): Promise<Alert[]> {
  const { data, error } = await fx!.svc
    .from('stock_alerts')
    .select('id, user_id, item_slug, due_at, notified_at')
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

  it('a live listing linked to the item makes only that item’s alert due', async () => {
    expect((await alerts()).every((a) => a.due_at === null)).toBe(true)
    // Approve first (no item yet), then link: the "re-linked" path of the trigger.
    await activateFixtureListing(fx!.svc, fx!.listingId, fx!.admin.id, { value_item_slug: itemSlug })
    const rows = await alerts()
    expect(rows.find((a) => a.item_slug === itemSlug)!.due_at).not.toBeNull()
    expect(rows.find((a) => a.item_slug === otherSlug)!.due_at).toBeNull()
  })

  it('two concurrent claims hand the due alert to exactly one of them, once', async () => {
    const mine = (await alerts()).find((a) => a.item_slug === itemSlug)!
    const [a, b] = await Promise.all([claim(500), claim(500)])
    const foreign = [...a, ...b].filter((c) => c.user_id !== fx!.buyer.id && c.user_id !== fx!.seller.id).map((c) => c.id)
    if (foreign.length) await fx!.svc.from('stock_alerts').update({ notified_at: null }).in('id', foreign)

    expect([...a, ...b].filter((c) => c.id === mine.id)).toHaveLength(1)
    expect((await alerts()).find((x) => x.id === mine.id)!.notified_at).not.toBeNull()
    expect((await claim(500)).some((c) => c.id === mine.id)).toBe(false)
  })

  it('re-linking the listing does not re-arm an alert that was already sent', async () => {
    const before = (await alerts()).find((a) => a.item_slug === itemSlug)!
    await fx!.svc.from('listings').update({ value_item_slug: null }).eq('id', fx!.listingId)
    await fx!.svc.from('listings').update({ value_item_slug: itemSlug }).eq('id', fx!.listingId)
    const after = (await alerts()).find((a) => a.item_slug === itemSlug)!
    expect(after.due_at).toBe(before.due_at)
    expect(after.notified_at).toBe(before.notified_at)
  })
})
