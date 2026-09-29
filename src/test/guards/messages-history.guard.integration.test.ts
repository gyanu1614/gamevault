/**
 * Chat history + system notices (integration) —
 * migration 20260927184110_messages_system_notices_and_read_only_history.
 *
 *   · a participant can still mark the other side's messages read;
 *   · a participant can NOT rewrite a message (content / sender), theirs or
 *     the other party's — chat is dispute evidence;
 *   · no signed-in user can write a sender-less (system) message;
 *   · the service role can write a system notice, only in the notice shape.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let convoId = ''
let sellerMsgId = ''
let buyerMsgId = ''

describe.skipIf(!hasEnv)('messages: read-only history + system notices (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    const { data: convo, error } = await fx.svc
      .from('conversations')
      .insert({ buyer_id: fx.buyer.id, seller_id: fx.seller.id })
      .select('id')
      .single()
    if (error) throw new Error(`conversation: ${error.message}`)
    convoId = (convo as any).id
    const { data: s, error: se } = await fx.seller.client
      .from('messages')
      .insert({ conversation_id: convoId, sender_id: fx.seller.id, content: 'Delivered, check your inventory' })
      .select('id')
      .single()
    if (se) throw new Error(`seller message: ${se.message}`)
    sellerMsgId = (s as any).id
    const { data: b, error: be } = await fx.buyer.client
      .from('messages')
      .insert({ conversation_id: convoId, sender_id: fx.buyer.id, content: 'Got it, thanks' })
      .select('id')
      .single()
    if (be) throw new Error(`buyer message: ${be.message}`)
    buyerMsgId = (b as any).id
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    if (convoId) {
      await fx.svc.from('messages').delete().eq('conversation_id', convoId)
      await fx.svc.from('conversations').delete().eq('id', convoId)
    }
    await fx.cleanup()
  }, 60_000)

  it('a participant can still mark the other side read', async () => {
    const { error } = await fx!.buyer.client
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', sellerMsgId)
    expect(error).toBeNull()
    const { data } = await fx!.svc.from('messages').select('is_read').eq('id', sellerMsgId).single()
    expect((data as any).is_read).toBe(true)
  })

  it("nobody can rewrite a message — not the other party's, not their own", async () => {
    const other = await fx!.buyer.client.from('messages').update({ content: 'Never delivered' }).eq('id', sellerMsgId)
    expect(other.error?.message ?? '').toMatch(/permission denied/i)
    const own = await fx!.buyer.client.from('messages').update({ content: 'edited' }).eq('id', buyerMsgId)
    expect(own.error?.message ?? '').toMatch(/permission denied/i)
    const sender = await fx!.buyer.client.from('messages').update({ sender_id: null }).eq('id', buyerMsgId)
    expect(sender.error?.message ?? '').toMatch(/permission denied/i)
    const { data } = await fx!.svc.from('messages').select('content, sender_id').eq('id', sellerMsgId).single()
    expect(data).toMatchObject({ content: 'Delivered, check your inventory', sender_id: fx!.seller.id })
  })

  it('no signed-in user can write a system (sender-less) message', async () => {
    const { error } = await fx!.buyer.client
      .from('messages')
      .insert({ conversation_id: convoId, sender_id: null, content: '{"type":"dispute_resolved","resolution":"buyer_favor"}' })
    expect(error).not.toBeNull()
  })

  it('the service role writes a notice, and only in the notice shape', async () => {
    const ok = await fx!.svc
      .from('messages')
      .insert({ conversation_id: convoId, sender_id: null, content: '{"type":"dispute_opened","reason":"x"}', is_read: true })
    expect(ok.error).toBeNull()
    const bad = await fx!.svc
      .from('messages')
      .insert({ conversation_id: convoId, sender_id: null, content: 'plain text with no author' })
    expect(bad.error?.message ?? '').toMatch(/messages_system_notice_shape/)
  })
})
