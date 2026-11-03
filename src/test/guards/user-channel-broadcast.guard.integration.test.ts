/**
 * The user's live channel (integration) — migration
 * 20261102161908_user_channel_broadcast.
 *
 *   · a signed-in user joins user:<their id>, and nobody else's;
 *   · a new chat message reaches BOTH parties' channels; a new notification,
 *     an order change and a profile change reach the right user.
 *
 * Needs the local Realtime service (`pnpm db:up --full`, or
 * SUPABASE_REALTIME_ENABLED=true in supabase/.env); skips without it, like
 * chat-reply-reactions.guard.integration.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let convo = ''
let realtimeUp = false
const channels: { client: SupabaseClient; channel: RealtimeChannel }[] = []

type Seen = { event: string; payload: Record<string, unknown> }
type Joined = { status: string; seen: Seen[]; channel: RealtimeChannel }

// realtime-js hands back the existing channel for a topic it already has, so
// a second join of the same (client, topic) reuses the first one.
const joined = new Map<string, Joined>()

async function joinUserTopic(client: SupabaseClient, userId: string, timeoutMs = 8000): Promise<Joined> {
  const { data } = await client.auth.getSession()
  const key = `${data.session?.user.id}->${userId}`
  const prior = joined.get(key)
  if (prior) return prior
  if (data.session) client.realtime.setAuth(data.session.access_token)
  const seen: Seen[] = []
  const channel = client.channel(`user:${userId}`, { config: { private: true } })
  channel.on('broadcast', { event: '*' }, (msg) => seen.push(msg as unknown as Seen))
  channels.push({ client, channel })
  const status = await new Promise<string>((resolve) => {
    const t = setTimeout(() => resolve('TIMED_OUT'), timeoutMs)
    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'CLOSED') {
        clearTimeout(t)
        resolve(s)
      }
    })
  })
  const result = { status, seen, channel }
  joined.set(key, result)
  return result
}

async function waitFor<T>(fn: () => T | undefined, timeoutMs = 8000): Promise<T | undefined> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const v = fn()
    if (v !== undefined) return v
    await new Promise((r) => setTimeout(r, 100))
  }
  return undefined
}

async function realtimeAvailable(client: SupabaseClient): Promise<boolean> {
  const channel = client.channel(`guard-probe-${Date.now()}`)
  const ok = await new Promise<boolean>((resolve) => {
    const t = setTimeout(() => resolve(false), 5000)
    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        clearTimeout(t)
        resolve(true)
      }
    })
  })
  await client.removeChannel(channel)
  return ok
}

describe.skipIf(!hasEnv)('user live channel (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    const { data, error } = await fx.svc
      .from('conversations')
      .insert({ buyer_id: fx.buyer.id, seller_id: fx.seller.id })
      .select('id')
      .single()
    if (error) throw new Error(`conversation: ${error.message}`)
    convo = (data as { id: string }).id
    // Probe on a client the tests never join with: removing the probe's only
    // channel closes that client's socket, and a join racing the reconnect is
    // dropped by realtime-js (10 s timeout, then a retry).
    realtimeUp = await realtimeAvailable(fx.admin.client)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    for (const { client, channel } of channels) await client.removeChannel(channel)
    if (convo) {
      await fx.svc.from('messages').delete().eq('conversation_id', convo)
      await fx.svc.from('conversations').delete().eq('id', convo)
    }
    // Notifications written by this file go with the fixture users
    // (DEPENDENT_TABLES: notifications.user_id).
    await fx.cleanup()
  }, 60_000)

  it("a user joins their own channel and not someone else's", async (ctx) => {
    if (!realtimeUp) ctx.skip()
    const own = await joinUserTopic(fx!.seller.client, fx!.seller.id)
    expect(own.status).toBe('SUBSCRIBED')
    const other = await joinUserTopic(fx!.seller.client, fx!.buyer.id)
    expect(other.status).not.toBe('SUBSCRIBED')
    // Stop the refused channel's re-join attempts; the seller's own channel
    // stays (and keeps that socket open) for the next test.
    await fx!.seller.client.removeChannel(other.channel)
  }, 30_000)

  it('a new message, notification, order change and profile change arrive live', async (ctx) => {
    if (!realtimeUp) ctx.skip()
    const buyer = await joinUserTopic(fx!.buyer.client, fx!.buyer.id)
    const seller = await joinUserTopic(fx!.seller.client, fx!.seller.id)
    expect(buyer.status).toBe('SUBSCRIBED')
    expect(seller.status).toBe('SUBSCRIBED')

    const sent = await fx!.seller.client
      .from('messages')
      .insert({ conversation_id: convo, sender_id: fx!.seller.id, content: 'Ready when you are' })
    expect(sent.error).toBeNull()
    const toBuyer = await waitFor(() => buyer.seen.find((m) => m.event === 'message' && m.payload.conversation_id === convo))
    const toSeller = await waitFor(() => seller.seen.find((m) => m.event === 'message' && m.payload.conversation_id === convo))
    expect(toBuyer?.payload.content).toBe('Ready when you are')
    expect(toSeller?.payload.sender_id).toBe(fx!.seller.id)

    const n = await fx!.svc
      .from('notifications')
      .insert({ user_id: fx!.buyer.id, type: 'order_message', title: 'Guard', message: 'live channel', link: '/' })
    expect(n.error).toBeNull()
    expect(await waitFor(() => buyer.seen.find((m) => m.event === 'notification'))).toBeDefined()

    const o = await fx!.svc.from('orders').update({ updated_at: new Date().toISOString() }).eq('id', fx!.completedOrderId)
    expect(o.error).toBeNull()
    const orderEvent = await waitFor(() => buyer.seen.find((m) => m.event === 'order'))
    expect(orderEvent?.payload.order_id).toBe(fx!.completedOrderId)

    const p = await fx!.svc.from('profiles').update({ full_name: 'Live Channel Guard' }).eq('id', fx!.buyer.id)
    expect(p.error).toBeNull()
    const profileEvent = await waitFor(() => buyer.seen.find((m) => m.event === 'profile'))
    expect(profileEvent?.payload.full_name).toBe('Live Channel Guard')
    // Nothing of the buyer's leaked onto the seller's channel.
    expect(seller.seen.some((m) => m.event === 'profile' || m.event === 'notification')).toBe(false)
  }, 60_000)
})
