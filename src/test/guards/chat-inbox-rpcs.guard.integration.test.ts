/**
 * Chat inbox + unread badge RPCs, chat RLS, conversation write lock
 * (integration) — migration 20261102161043_chat_inbox_unread_rpcs_and_rls.
 *
 *   · my_inbox(): the caller's conversations only, newest first, with the
 *     other party, order summary, last message and unread count, in ONE
 *     call; keyset pages never repeat or skip a row;
 *   · my_unread_message_count(): unread messages from the other party
 *     (not my own, not DropMarket notices), back to 0 once read;
 *   · RLS still lets participants and admins read, and nobody else;
 *   · a participant can no longer re-point a conversation (seller_id) at
 *     another user; anon has no access at all.
 *
 * Conversations: A = buyer ↔ seller on the completed order, B = buyer ↔
 * seller direct message, C = admin (as buyer) ↔ seller, so the fixture buyer
 * is an outsider to C.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, URL, ANON, type Fixture } from './throwaway'

let fx: Fixture | null = null
let convoA = ''
let convoB = ''
let convoC = ''

type InboxRow = {
  id: string
  order_id: string | null
  buyer_id: string
  seller_id: string
  last_message_at: string
  buyer: { id: string; username: string } | null
  seller: { id: string; username: string; is_verified: boolean | null } | null
  last_message: { content: string; sender_id: string | null } | null
  unread_count: number
  order: { id: string; order_number: string | null; status: string; listing: { id: string; images: string[] } | null } | null
}

async function newConversation(buyerId: string, sellerId: string, orderId: string | null = null): Promise<string> {
  const { data, error } = await fx!.svc
    .from('conversations')
    .insert({ buyer_id: buyerId, seller_id: sellerId, order_id: orderId })
    .select('id')
    .single()
  if (error) throw new Error(`conversation: ${error.message}`)
  return (data as { id: string }).id
}

async function send(client: SupabaseClient, conversationId: string, senderId: string | null, content: string) {
  const { error } = await client.from('messages').insert({ conversation_id: conversationId, sender_id: senderId, content })
  if (error) throw new Error(`send: ${error.message}`)
  // Distinct created_at per message so "last message" is unambiguous.
  await new Promise((r) => setTimeout(r, 15))
}

async function inbox(client: SupabaseClient, args: Record<string, unknown> = {}): Promise<InboxRow[]> {
  const { data, error } = await client.rpc('my_inbox', args)
  if (error) throw new Error(`my_inbox: ${error.message}`)
  return data as InboxRow[]
}

async function unread(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.rpc('my_unread_message_count')
  if (error) throw new Error(`my_unread_message_count: ${error.message}`)
  return data as number
}

describe.skipIf(!hasEnv)('chat inbox + unread RPCs, chat RLS (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    convoA = await newConversation(fx.buyer.id, fx.seller.id, fx.completedOrderId)
    convoB = await newConversation(fx.buyer.id, fx.seller.id)
    convoC = await newConversation(fx.admin.id, fx.seller.id)

    await send(fx.buyer.client, convoA, fx.buyer.id, 'Hi, is this still available?')
    await send(fx.seller.client, convoA, fx.seller.id, 'Yes')
    await send(fx.seller.client, convoA, fx.seller.id, 'What is your username?')
    // A DropMarket notice (sender NULL): never "unread" for anyone.
    await send(fx.svc, convoA, null, '{"type":"order_delivered","seller":"x"}')
    await send(fx.seller.client, convoB, fx.seller.id, 'Thanks for the follow!')
    await send(fx.seller.client, convoC, fx.seller.id, 'Admin thread')
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    for (const id of [convoA, convoB, convoC].filter(Boolean)) {
      await fx.svc.from('messages').delete().eq('conversation_id', id)
      await fx.svc.from('conversations').delete().eq('id', id)
    }
    await fx.cleanup()
  }, 60_000)

  describe('my_inbox', () => {
    it("returns only the caller's conversations, newest first, in one call", async () => {
      const rows = await inbox(fx!.buyer.client)
      const ids = rows.map((r) => r.id)
      expect(ids).toEqual(expect.arrayContaining([convoA, convoB]))
      expect(ids).not.toContain(convoC)
      const times = rows.map((r) => Date.parse(r.last_message_at))
      expect(times).toEqual([...times].sort((a, b) => b - a))
    })

    it('carries the other party, order summary, last message and unread count', async () => {
      const a = (await inbox(fx!.buyer.client)).find((r) => r.id === convoA)!
      expect(a.seller?.id).toBe(fx!.seller.id)
      expect(a.buyer?.id).toBe(fx!.buyer.id)
      expect(a.order?.id).toBe(fx!.completedOrderId)
      expect(a.order?.listing?.id).toBe(fx!.listingId)
      expect(Array.isArray(a.order?.listing?.images)).toBe(true)
      expect(a.order!.listing!.images.length).toBeLessThanOrEqual(1)
      // Last message = the notice; unread = the seller's two lines only.
      expect(a.last_message?.sender_id).toBeNull()
      expect(a.unread_count).toBe(2)

      const b = (await inbox(fx!.buyer.client)).find((r) => r.id === convoB)!
      expect(b.order).toBeNull()
      expect(b.last_message?.content).toBe('Thanks for the follow!')
      expect(b.unread_count).toBe(1)
    })

    it("the seller's unread count is the buyer's message only", async () => {
      const a = (await inbox(fx!.seller.client)).find((r) => r.id === convoA)!
      expect(a.unread_count).toBe(1)
    })

    it('keyset pages never repeat or skip a conversation', async () => {
      const all = await inbox(fx!.seller.client, { p_limit: 100 })
      const first = await inbox(fx!.seller.client, { p_limit: 1 })
      expect(first).toHaveLength(1)
      const last = first[0]
      const rest = await inbox(fx!.seller.client, { p_limit: 100, p_before: last.last_message_at, p_before_id: last.id })
      expect([...first, ...rest].map((r) => r.id)).toEqual(all.map((r) => r.id))
    })

    it('anon cannot call it', async () => {
      const anon = createClient(URL!, ANON!, { auth: { persistSession: false } })
      const { error } = await anon.rpc('my_inbox')
      expect(error).not.toBeNull()
    })
  })

  describe('my_unread_message_count', () => {
    it('counts unread messages from the other party across conversations', async () => {
      expect(await unread(fx!.buyer.client)).toBe(3)
      expect(await unread(fx!.seller.client)).toBe(1)
    })

    it('drops to 0 once the reader marks them read', async () => {
      const { error } = await fx!.buyer.client
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('conversation_id', [convoA, convoB])
        .neq('sender_id', fx!.buyer.id)
      expect(error).toBeNull()
      expect(await unread(fx!.buyer.client)).toBe(0)
      expect(await unread(fx!.seller.client)).toBe(1)
    })

    it('anon cannot call it', async () => {
      const anon = createClient(URL!, ANON!, { auth: { persistSession: false } })
      const { error } = await anon.rpc('my_unread_message_count')
      expect(error).not.toBeNull()
    })
  })

  describe('RLS and the conversation write lock', () => {
    it('participants and admins read a thread; an outsider sees nothing', async () => {
      const buyerSees = await fx!.buyer.client.from('messages').select('id').eq('conversation_id', convoA)
      expect(buyerSees.data?.length).toBe(4)
      const adminSees = await fx!.admin.client.from('messages').select('id').eq('conversation_id', convoA)
      expect(adminSees.data?.length).toBe(4)
      const outsider = await fx!.buyer.client.from('messages').select('id').eq('conversation_id', convoC)
      expect(outsider.data ?? []).toHaveLength(0)
      const outsiderConvo = await fx!.buyer.client.from('conversations').select('id').eq('id', convoC)
      expect(outsiderConvo.data ?? []).toHaveLength(0)
    })

    it('a participant sends only as themselves, and an outsider cannot send', async () => {
      const spoof = await fx!.buyer.client
        .from('messages')
        .insert({ conversation_id: convoA, sender_id: fx!.seller.id, content: 'spoofed' })
      expect(spoof.error).not.toBeNull()
      const outsider = await fx!.buyer.client
        .from('messages')
        .insert({ conversation_id: convoC, sender_id: fx!.buyer.id, content: 'let me in' })
      expect(outsider.error).not.toBeNull()
    })

    it('a participant can no longer re-point a conversation at another user', async () => {
      const { error } = await fx!.buyer.client.from('conversations').update({ seller_id: fx!.admin.id }).eq('id', convoB)
      expect(error).not.toBeNull()
      const { data } = await fx!.svc.from('conversations').select('seller_id').eq('id', convoB).single()
      expect((data as { seller_id: string }).seller_id).toBe(fx!.seller.id)
    })

    it("nobody can open an order chat on someone else's order", async () => {
      // The admin is party to neither fixture order (admin powers do not apply to INSERT here).
      const { error } = await fx!.admin.client
        .from('conversations')
        .insert({ buyer_id: fx!.admin.id, seller_id: fx!.seller.id, order_id: fx!.pendingOrderId })
      expect(error).not.toBeNull()
      const { data } = await fx!.svc.from('conversations').select('id').eq('order_id', fx!.pendingOrderId)
      expect(data ?? []).toHaveLength(0)
    })

    it('a party cannot bind an order chat to anyone but the order\'s own buyer and seller', async () => {
      // First insert wins (order_id is unique): a forged row would lock the real
      // seller out and show staff a made-up thread as the order's chat.
      const forged = [
        // The buyer naming another account as the seller.
        { client: fx!.buyer.client, row: { buyer_id: fx!.buyer.id, seller_id: fx!.admin.id } },
        // The buyer on both sides.
        { client: fx!.buyer.client, row: { buyer_id: fx!.buyer.id, seller_id: fx!.buyer.id } },
        // The seller naming another account as the buyer.
        { client: fx!.seller.client, row: { buyer_id: fx!.admin.id, seller_id: fx!.seller.id } },
      ]
      for (const { client, row } of forged) {
        const { error } = await client.from('conversations').insert({ ...row, order_id: fx!.pendingOrderId })
        expect(error, JSON.stringify(row)).not.toBeNull()
      }
      const { data } = await fx!.svc.from('conversations').select('id').eq('order_id', fx!.pendingOrderId)
      expect(data ?? []).toHaveLength(0)
    })

    it('nobody can open a chat with no order (it reaches any user, and emails them)', async () => {
      const { error } = await fx!.buyer.client.from('conversations').insert({ buyer_id: fx!.buyer.id, seller_id: fx!.admin.id, order_id: null })
      expect(error).not.toBeNull()
    })

    it('the real seller can open the chat on their order', async () => {
      const { data, error } = await fx!.seller.client
        .from('conversations')
        .insert({ buyer_id: fx!.buyer.id, seller_id: fx!.seller.id, order_id: fx!.pendingOrderId })
        .select('id')
        .single()
      expect(error).toBeNull()
      await fx!.svc.from('conversations').delete().eq('id', (data as { id: string }).id)
    })

    it('still lets a participant mark the other side read (and nothing else)', async () => {
      const read = await fx!.seller.client
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', convoA)
        .eq('sender_id', fx!.buyer.id)
        .select('id')
      expect(read.error).toBeNull()
      expect(read.data?.length).toBe(1)
      const rewrite = await fx!.seller.client.from('messages').update({ content: 'edited' }).eq('conversation_id', convoA)
      expect(rewrite.error).not.toBeNull()
    })

    it('anon reads no messages or conversations', async () => {
      const anon = createClient(URL!, ANON!, { auth: { persistSession: false } })
      const m = await anon.from('messages').select('id').eq('conversation_id', convoA)
      const c = await anon.from('conversations').select('id').eq('id', convoA)
      expect(m.data ?? []).toHaveLength(0)
      expect(c.data ?? []).toHaveLength(0)
    })
  })
})
