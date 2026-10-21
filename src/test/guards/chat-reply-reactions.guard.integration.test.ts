/**
 * Chat replies, reactions and instant delivery (integration) —
 * migration 20261021222022_chat_replies_reactions_broadcast.
 *
 *   · a reply points at a message in the SAME conversation, and can't be
 *     re-pointed later (history stays dispute evidence);
 *   · reactions: one per person per message, only the six chat emoji, only a
 *     participant (or admin) reacts, only as themselves, and nobody outside
 *     the conversation reads them;
 *   · delivery: every new message / reaction is broadcast to the private
 *     topic chat:<conversation id>. A participant's channel receives it;
 *     an outsider can't even join.
 *
 * Two conversations: A = buyer ↔ seller, B = admin (as buyer) ↔ seller, so
 * the fixture buyer is an outsider to B.
 *
 * The delivery tests need the local Realtime service (`pnpm db:up --full`, or
 * SUPABASE_REALTIME_ENABLED=true in supabase/.env); they skip without it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, type Fixture } from './throwaway'
import { CHAT_REACTIONS } from '@/lib/chat/reactions'
import { THREAD_SELECT, splitThreadRows } from '@/lib/chat/thread-read'

let fx: Fixture | null = null
let convoA = ''
let convoB = ''
let sellerMsgA = ''
let sellerMsgB = ''
let realtimeUp = false
const channels: { client: SupabaseClient; channel: RealtimeChannel }[] = []

const THUMBS = CHAT_REACTIONS[0]
const HEART = CHAT_REACTIONS[1]

async function newConversation(buyerId: string, sellerId: string): Promise<string> {
  const { data, error } = await fx!.svc.from('conversations').insert({ buyer_id: buyerId, seller_id: sellerId }).select('id').single()
  if (error) throw new Error(`conversation: ${error.message}`)
  return (data as { id: string }).id
}

async function send(client: SupabaseClient, conversationId: string, senderId: string, content: string, extra: Record<string, unknown> = {}) {
  return client.from('messages').insert({ conversation_id: conversationId, sender_id: senderId, content, ...extra }).select('id, reply_to_id').single()
}

type Broadcast = { event: string; payload: { table: string; operation: string; record: Record<string, unknown> | null; old_record: Record<string, unknown> | null } }

/** Join `chat:<id>` as a private channel; resolves with the join status and every broadcast seen. */
async function joinChat(client: SupabaseClient, conversationId: string, timeoutMs = 8000) {
  const { data } = await client.auth.getSession()
  if (data.session) client.realtime.setAuth(data.session.access_token)
  const seen: Broadcast[] = []
  const channel = client.channel(`chat:${conversationId}`, { config: { private: true } })
  channel.on('broadcast', { event: '*' }, (msg) => seen.push(msg as unknown as Broadcast))
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
  return { status, seen }
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

/** Is the stack's Realtime service answering? A public channel joins without any policy. */
async function realtimeAvailable(client: SupabaseClient): Promise<boolean> {
  const channel = client.channel(`guard-probe-${Date.now()}`)
  const ok = await new Promise<boolean>((resolve) => {
    const t = setTimeout(() => resolve(false), 5000)
    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED') { clearTimeout(t); resolve(true) }
    })
  })
  await client.removeChannel(channel)
  return ok
}

describe.skipIf(!hasEnv)('chat: replies, reactions, instant delivery (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    convoA = await newConversation(fx.buyer.id, fx.seller.id)
    convoB = await newConversation(fx.admin.id, fx.seller.id)
    const a = await send(fx.seller.client, convoA, fx.seller.id, 'Ready when you are')
    if (a.error) throw new Error(`seller message A: ${a.error.message}`)
    sellerMsgA = (a.data as { id: string }).id
    const b = await send(fx.svc, convoB, fx.seller.id, 'Other thread')
    if (b.error) throw new Error(`seller message B: ${b.error.message}`)
    sellerMsgB = (b.data as { id: string }).id
    realtimeUp = await realtimeAvailable(fx.buyer.client)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    for (const { client, channel } of channels) await client.removeChannel(channel)
    for (const id of [convoA, convoB].filter(Boolean)) {
      // message_reactions go with their message (ON DELETE CASCADE).
      await fx.svc.from('messages').delete().eq('conversation_id', id)
      await fx.svc.from('conversations').delete().eq('id', id)
    }
    const { count } = await fx.svc.from('message_reactions').select('message_id', { count: 'exact', head: false }).in('conversation_id', [convoA, convoB])
    await fx.cleanup()
    expect(count ?? 0).toBe(0)
  }, 60_000)

  describe('replies', () => {
    it('a participant replies to a message in the same conversation', async () => {
      const { data, error } = await send(fx!.buyer.client, convoA, fx!.buyer.id, 'Sending now', { reply_to_id: sellerMsgA })
      expect(error).toBeNull()
      expect((data as { reply_to_id: string }).reply_to_id).toBe(sellerMsgA)
    })

    it('a reply can not point at a message from another conversation', async () => {
      const { error } = await send(fx!.seller.client, convoA, fx!.seller.id, 'Wrong thread', { reply_to_id: sellerMsgB })
      expect(error?.code).toBe('23514')
    })

    it('a reply can not be re-pointed after it is sent', async () => {
      const { data } = await send(fx!.buyer.client, convoA, fx!.buyer.id, 'First')
      const { error } = await fx!.buyer.client.from('messages').update({ reply_to_id: sellerMsgA }).eq('id', (data as { id: string }).id)
      expect(error?.message ?? '').toMatch(/permission denied/i)
    })
  })

  describe('reactions', () => {
    it('the DB accepts exactly the six chat emoji', async () => {
      const { error } = await fx!.buyer.client.from('message_reactions').insert({ message_id: sellerMsgA, emoji: '🔥' })
      expect(error?.code).toBe('23514')
    })

    it('a participant reacts; both sides read it; the conversation comes from the message', async () => {
      const { error } = await fx!.buyer.client.from('message_reactions').insert({ message_id: sellerMsgA, emoji: THUMBS })
      expect(error).toBeNull()
      const { data: seen } = await fx!.seller.client.from('message_reactions').select('user_id, emoji, conversation_id').eq('message_id', sellerMsgA)
      expect(seen).toEqual([{ user_id: fx!.buyer.id, emoji: THUMBS, conversation_id: convoA }])
    })

    it('one reaction per person: a second insert is a duplicate, changing it is an update', async () => {
      const dup = await fx!.buyer.client.from('message_reactions').insert({ message_id: sellerMsgA, emoji: HEART })
      expect(dup.error?.code).toBe('23505')
      const upd = await fx!.buyer.client.from('message_reactions').update({ emoji: HEART }).eq('message_id', sellerMsgA).eq('user_id', fx!.buyer.id).select('emoji')
      expect(upd.error).toBeNull()
      expect(upd.data).toEqual([{ emoji: HEART }])
    })

    it('nobody reacts as someone else, or rewrites someone else\'s reaction', async () => {
      const asOther = await fx!.buyer.client.from('message_reactions').insert({ message_id: sellerMsgA, emoji: THUMBS, user_id: fx!.seller.id })
      expect(asOther.error).not.toBeNull()
      const rewrite = await fx!.seller.client.from('message_reactions').update({ emoji: THUMBS }).eq('message_id', sellerMsgA).eq('user_id', fx!.buyer.id).select()
      expect(rewrite.data ?? []).toEqual([])
      const remove = await fx!.seller.client.from('message_reactions').delete().eq('message_id', sellerMsgA).eq('user_id', fx!.buyer.id).select()
      expect(remove.data ?? []).toEqual([])
      const { data } = await fx!.svc.from('message_reactions').select('emoji').eq('message_id', sellerMsgA).eq('user_id', fx!.buyer.id)
      expect(data).toEqual([{ emoji: HEART }])
    })

    it('an outsider can neither react nor read reactions in a conversation', async () => {
      const { error: se } = await fx!.seller.client.from('message_reactions').insert({ message_id: sellerMsgB, emoji: THUMBS })
      expect(se).toBeNull()
      const react = await fx!.buyer.client.from('message_reactions').insert({ message_id: sellerMsgB, emoji: THUMBS })
      expect(react.error?.code).toBe('42501')
      const { data } = await fx!.buyer.client.from('message_reactions').select('emoji').eq('message_id', sellerMsgB)
      expect(data ?? []).toEqual([])
    })

    it('the thread read (messages + embedded reactions) returns them to a participant in one request', async () => {
      const { data, error } = await fx!.seller.client.from('messages').select(THREAD_SELECT).eq('conversation_id', convoA).order('created_at')
      expect(error).toBeNull()
      const { rows, reactions } = splitThreadRows(data)
      expect(rows.some((m) => m.id === sellerMsgA)).toBe(true)
      expect(reactions).toContainEqual(expect.objectContaining({ message_id: sellerMsgA, user_id: fx!.buyer.id, emoji: HEART }))
    })

    it('the anon key reads nothing', async () => {
      const { createClient } = await import('@supabase/supabase-js')
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
      const { data, error } = await anon.from('message_reactions').select('emoji').limit(1)
      expect(error?.code ?? (data?.length ? 'rows' : 'none')).not.toBe('rows')
    })

    it('a person removes their own reaction', async () => {
      const { error } = await fx!.buyer.client.from('message_reactions').delete().eq('message_id', sellerMsgA).eq('user_id', fx!.buyer.id)
      expect(error).toBeNull()
      const { data } = await fx!.svc.from('message_reactions').select('emoji').eq('message_id', sellerMsgA).eq('user_id', fx!.buyer.id)
      expect(data).toEqual([])
    })
  })

  describe('instant delivery (private broadcast)', () => {
    it('a participant receives the other side\'s new message and reaction on chat:<id>', async (ctx) => {
      if (!realtimeUp) ctx.skip()
      const { status, seen } = await joinChat(fx!.seller.client, convoA)
      expect(status).toBe('SUBSCRIBED')
      const { data: msg, error } = await send(fx!.buyer.client, convoA, fx!.buyer.id, 'Live?')
      expect(error).toBeNull()
      const id = (msg as { id: string }).id
      const got = await waitFor(() => seen.find((b) => b.payload.table === 'messages' && b.payload.record?.id === id))
      expect(got?.event).toBe('message')
      expect(got?.payload.operation).toBe('INSERT')
      expect(got?.payload.record).toMatchObject({ conversation_id: convoA, sender_id: fx!.buyer.id, content: 'Live?' })

      await fx!.buyer.client.from('message_reactions').insert({ message_id: sellerMsgA, emoji: THUMBS })
      const reacted = await waitFor(() => seen.find((b) => b.payload.table === 'message_reactions' && b.payload.operation === 'INSERT'))
      expect(reacted?.event).toBe('reaction')
      expect(reacted?.payload.record).toMatchObject({ message_id: sellerMsgA, user_id: fx!.buyer.id, emoji: THUMBS })

      await fx!.buyer.client.from('message_reactions').delete().eq('message_id', sellerMsgA).eq('user_id', fx!.buyer.id)
      const removed = await waitFor(() => seen.find((b) => b.payload.table === 'message_reactions' && b.payload.operation === 'DELETE'))
      expect(removed?.payload.old_record).toMatchObject({ message_id: sellerMsgA, user_id: fx!.buyer.id })
    }, 30_000)

    it('an outsider can not join another conversation\'s topic', async (ctx) => {
      if (!realtimeUp) ctx.skip()
      const { status, seen } = await joinChat(fx!.buyer.client, convoB)
      expect(status).not.toBe('SUBSCRIBED')
      await send(fx!.svc, convoB, fx!.seller.id, 'Private')
      await new Promise((r) => setTimeout(r, 1500))
      expect(seen).toEqual([])
    }, 30_000)
  })
})
