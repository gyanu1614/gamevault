/**
 * Chat email batching (integration) — migration 20261102161137_chat_email_digest.
 *
 *   · a burst of messages makes ONE queue row, due 2 min after the last
 *     message (never more than 10 min after the first);
 *   · claim leases a due batch once (a second claim gets nothing), and
 *     returns what the email needs: recipient, sender name, order, unread
 *     count and the latest unread lines oldest first;
 *   · a batch read in the app before it is due claims with 0 unread (the
 *     sender route then skips it);
 *   · after an email, the next one waits out the 15 min cooldown;
 *   · a failed send retries; messages during a claim start a new batch;
 *   · DropMarket notices, "Delivery Evidence" posts and a non-participant
 *     (admin) never queue an email;
 *   · nothing here is reachable by a signed-in user.
 *
 * Time is moved by editing send_after through the service role, so the test
 * never waits out the real windows.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let convo = ''
let dm = ''

type QueueRow = {
  conversation_id: string
  recipient_id: string
  batch_started_at: string | null
  last_message_at: string
  send_after: string | null
  last_sent_at: string | null
  claimed_at: string | null
  attempts: number
}

type Claimed = {
  conversation_id: string
  recipient_id: string
  claimed_at: string
  recipient_email: string | null
  recipient_name: string
  sender_name: string
  order_id: string | null
  order_number: string | null
  unread_count: number
  messages: { content: string; created_at: string; has_attachment: boolean }[]
}

async function send(client: SupabaseClient, conversationId: string, senderId: string | null, content: string) {
  const { error } = await client.from('messages').insert({ conversation_id: conversationId, sender_id: senderId, content })
  if (error) throw new Error(`send: ${error.message}`)
  await new Promise((r) => setTimeout(r, 15))
}

async function row(conversationId: string, recipientId: string): Promise<QueueRow | null> {
  const { data, error } = await fx!.svc
    .from('chat_email_queue')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('recipient_id', recipientId)
    .maybeSingle()
  if (error) throw new Error(`queue read: ${error.message}`)
  return data as QueueRow | null
}

async function makeDue(conversationId: string, recipientId: string) {
  const { error } = await fx!.svc
    .from('chat_email_queue')
    .update({ send_after: new Date(Date.now() - 1000).toISOString() })
    .eq('conversation_id', conversationId)
    .eq('recipient_id', recipientId)
  if (error) throw new Error(`makeDue: ${error.message}`)
}

async function claim(): Promise<Claimed[]> {
  const { data, error } = await fx!.svc.rpc('chat_email_claim_due', { p_limit: 100 })
  if (error) throw new Error(`claim: ${error.message}`)
  return (data as Claimed[]).filter((c) => c.conversation_id === convo || c.conversation_id === dm)
}

async function complete(c: Claimed, outcome: 'sent' | 'skipped' | 'failed') {
  const { error } = await fx!.svc.rpc('chat_email_complete', {
    p_results: [{ conversation_id: c.conversation_id, recipient_id: c.recipient_id, claimed_at: c.claimed_at, outcome }],
  })
  if (error) throw new Error(`complete: ${error.message}`)
}

const secondsUntil = (iso: string | null) => (Date.parse(iso!) - Date.now()) / 1000

describe.skipIf(!hasEnv)('chat email batching (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    const a = await fx.svc
      .from('conversations')
      .insert({ buyer_id: fx.buyer.id, seller_id: fx.seller.id, order_id: fx.completedOrderId })
      .select('id')
      .single()
    if (a.error) throw new Error(`conversation: ${a.error.message}`)
    convo = (a.data as { id: string }).id
    const b = await fx.svc.from('conversations').insert({ buyer_id: fx.buyer.id, seller_id: fx.seller.id }).select('id').single()
    if (b.error) throw new Error(`dm: ${b.error.message}`)
    dm = (b.data as { id: string }).id
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    for (const id of [convo, dm].filter(Boolean)) {
      await fx.svc.from('messages').delete().eq('conversation_id', id)
      // chat_email_queue rows go with the conversation (ON DELETE CASCADE).
      await fx.svc.from('conversations').delete().eq('id', id)
    }
    const { data } = await fx.svc.from('chat_email_queue').select('conversation_id').in('conversation_id', [convo, dm].filter(Boolean))
    await fx.cleanup()
    expect(data ?? []).toHaveLength(0)
  }, 60_000)

  it('a burst of messages makes one batch, due 2 min after the last line', async () => {
    await send(fx!.seller.client, convo, fx!.seller.id, 'Hey')
    await send(fx!.seller.client, convo, fx!.seller.id, 'how are you')
    await send(fx!.seller.client, convo, fx!.seller.id, "what's your user?")
    const q = await row(convo, fx!.buyer.id)
    expect(q).not.toBeNull()
    expect(q!.batch_started_at).not.toBeNull()
    expect(secondsUntil(q!.send_after)).toBeGreaterThan(100)
    expect(secondsUntil(q!.send_after)).toBeLessThanOrEqual(121)
    // The sender is not emailed about their own lines.
    expect(await row(convo, fx!.seller.id)).toBeNull()
  })

  it('is not claimed before it is due', async () => {
    expect(await claim()).toHaveLength(0)
  })

  it('claims a due batch once, with everything the email needs', async () => {
    await makeDue(convo, fx!.buyer.id)
    const [c, ...more] = await claim()
    expect(more).toHaveLength(0)
    expect(c.recipient_id).toBe(fx!.buyer.id)
    expect(c.recipient_email).toMatch(/@example\.com$/)
    expect(c.sender_name).not.toBe('Someone')
    expect(c.order_id).toBe(fx!.completedOrderId)
    expect(c.unread_count).toBe(3)
    expect(c.messages.map((m) => m.content)).toEqual(['Hey', 'how are you', "what's your user?"])
    // Leased: a second run gets nothing.
    expect(await claim()).toHaveLength(0)

    await complete(c, 'sent')
    const q = await row(convo, fx!.buyer.id)
    expect(q!.batch_started_at).toBeNull()
    expect(q!.send_after).toBeNull()
    expect(q!.claimed_at).toBeNull()
    expect(q!.last_sent_at).not.toBeNull()
  })

  it('after an email, the next batch waits out the 15 min cooldown', async () => {
    await send(fx!.seller.client, convo, fx!.seller.id, 'Still there?')
    const q = await row(convo, fx!.buyer.id)
    expect(q!.batch_started_at).not.toBeNull()
    expect(secondsUntil(q!.send_after)).toBeGreaterThan(14 * 60)
  })

  it('a batch read in the app before it is due claims with nothing unread', async () => {
    const read = await fx!.buyer.client
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('conversation_id', convo)
      .neq('sender_id', fx!.buyer.id)
    expect(read.error).toBeNull()
    await makeDue(convo, fx!.buyer.id)
    const [c] = await claim()
    expect(c.unread_count).toBe(0)
    expect(c.messages).toEqual([])
    await complete(c, 'skipped')
    expect((await row(convo, fx!.buyer.id))!.batch_started_at).toBeNull()
  })

  it('a failed send is retried, and messages during a claim start a new batch', async () => {
    await send(fx!.buyer.client, dm, fx!.buyer.id, 'Can you do it cheaper?')
    await makeDue(dm, fx!.seller.id)
    const [first] = await claim()
    expect(first.recipient_id).toBe(fx!.seller.id)
    expect(first.order_id).toBeNull()
    await complete(first, 'failed')
    const retry = await row(dm, fx!.seller.id)
    expect(retry!.batch_started_at).not.toBeNull()
    expect(retry!.claimed_at).toBeNull()
    expect(secondsUntil(retry!.send_after)).toBeGreaterThan(60)

    await makeDue(dm, fx!.seller.id)
    const [second] = await claim()
    await send(fx!.buyer.client, dm, fx!.buyer.id, 'Hello?')
    await complete(second, 'sent')
    const next = await row(dm, fx!.seller.id)
    expect(next!.batch_started_at).not.toBeNull()
    expect(secondsUntil(next!.send_after)).toBeGreaterThan(14 * 60)
  })

  it('notices, Delivery Evidence posts and a non-participant never queue an email', async () => {
    await fx!.svc.from('chat_email_queue').delete().eq('conversation_id', convo)
    await send(fx!.svc, convo, null, '{"type":"order_delivered","seller":"x"}')
    await send(fx!.seller.client, convo, fx!.seller.id, 'Delivery Evidence: sent to your mailbox')
    await send(fx!.admin.client, convo, fx!.admin.id, 'DropMarket support here')
    const { data } = await fx!.svc.from('chat_email_queue').select('recipient_id').eq('conversation_id', convo)
    expect(data ?? []).toHaveLength(0)
  })

  it('a signed-in user can neither read the queue nor call the sender RPCs', async () => {
    const q = await fx!.buyer.client.from('chat_email_queue').select('conversation_id')
    expect(q.error !== null || (q.data ?? []).length === 0).toBe(true)
    const c = await fx!.buyer.client.rpc('chat_email_claim_due', { p_limit: 1 })
    expect(c.error).not.toBeNull()
    const d = await fx!.buyer.client.rpc('chat_email_complete', { p_results: [] })
    expect(d.error).not.toBeNull()
  })
})
