/**
 * Bundle 2 task E — `value_funnel_events` is service-role only (the event
 * route writes it; nobody reads it but the funnel command), and the
 * `value_funnel_daily` view joins a paid order on a listing opened from a
 * value surface within 24 h.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { ANON, URL, hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
const game = `guard-fn-${Math.random().toString(36).slice(2, 8)}`

describe.skipIf(!hasEnv)('value funnel events (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
  }, 60_000)
  afterAll(async () => {
    await fx?.svc.from('value_funnel_events').delete().eq('game_slug', game)
    await fx?.cleanup()
  }, 60_000)

  it('anon cannot insert or read events', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } })
    const ins = await anon.from('value_funnel_events').insert({ event: 'value_view', surface: 'value_item', game_slug: game })
    expect(ins.error).not.toBeNull()
    const sel = await anon.from('value_funnel_events').select('id').limit(1)
    expect(sel.error ?? (sel.data?.length ? 'leak' : null)).not.toBeNull()
  })

  it('a signed-in user cannot read the funnel view', async () => {
    const sel = await fx!.buyer.client.from('value_funnel_daily').select('*').limit(1)
    expect(sel.error ?? (sel.data?.length ? 'leak' : null)).not.toBeNull()
  })

  it('rejects an unknown event', async () => {
    const res = await fx!.svc.from('value_funnel_events').insert({ event: 'purchase', surface: 'value_item', game_slug: game })
    expect(res.error).not.toBeNull()
  })

  it('counts views, clicks, opens and paid orders per day', async () => {
    const rows = [
      { event: 'value_view', surface: 'value_item', game_slug: game, item_slug: 'x' },
      { event: 'value_view', surface: 'value_item', game_slug: game, item_slug: 'x' },
      { event: 'cta_click', surface: 'value_item', game_slug: game, item_slug: 'x', state: 'in_stock' },
      { event: 'listing_opened', surface: 'item_buy', game_slug: game, item_slug: 'x', listing_id: fx!.listingId },
    ]
    const ins = await fx!.svc.from('value_funnel_events').insert(rows)
    expect(ins.error).toBeNull()
    // The fixture's completed order is on fx.listingId; mark it paid now so it
    // falls inside the 24 h window after the open.
    await fx!.svc.from('orders').update({ paid_at: new Date(Date.now() + 60_000).toISOString() }).eq('id', fx!.completedOrderId)

    const { data, error } = await fx!.svc.from('value_funnel_daily').select('*').eq('game_slug', game)
    expect(error).toBeNull()
    const today = (data ?? [])[0] as Record<string, number>
    expect(today.value_views).toBe(2)
    expect(today.cta_clicks).toBe(1)
    expect(today.listings_opened).toBe(1)
    expect(today.orders).toBe(1)
  })
})
