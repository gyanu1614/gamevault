import { describe, it, expect } from 'vitest'
import type { Conversation } from '@/lib/api/seller/types'
import {
  applyInboxMessage,
  markConversationRead,
  parseInboxMessageEvent,
  type InboxData,
  type InboxMessageEvent,
} from './inbox-cache'

const ME = 'me'
const THEM = 'them'

function convo(id: string, at: string, unread = 0): Conversation {
  return {
    id,
    order_id: null,
    buyer_id: ME,
    seller_id: THEM,
    last_message_at: at,
    created_at: at,
    unread_count: unread,
    last_message: { content: 'old', sender_id: THEM },
  }
}

function inbox(...pages: Conversation[][]): InboxData {
  return {
    pages: pages.map((conversations) => ({ conversations, next: null })),
    pageParams: pages.map(() => null),
  }
}

function msg(over: Partial<InboxMessageEvent> = {}): InboxMessageEvent {
  return { id: 'm1', conversation_id: 'b', sender_id: THEM, content: 'Hey', created_at: '2026-11-02T22:10:00Z', ...over }
}

describe('inbox cache', () => {
  const data = inbox([convo('a', '2026-11-02T22:00:00Z'), convo('b', '2026-11-02T21:00:00Z', 1)], [convo('c', '2026-11-01T10:00:00Z')])

  it('moves the conversation to the top with the new last message and one more unread', () => {
    const next = applyInboxMessage(data, msg(), { viewerId: ME })!
    expect(next.pages[0].conversations.map((c) => c.id)).toEqual(['b', 'a'])
    const b = next.pages[0].conversations[0]
    expect(b.last_message).toEqual({ content: 'Hey', sender_id: THEM })
    expect(b.last_message_at).toBe('2026-11-02T22:10:00Z')
    expect(b.unread_count).toBe(2)
  })

  it('pulls a conversation up from a later page', () => {
    const next = applyInboxMessage(data, msg({ conversation_id: 'c' }), { viewerId: ME })!
    expect(next.pages[0].conversations[0].id).toBe('c')
    expect(next.pages[1].conversations).toHaveLength(0)
  })

  it('my own message, a notice, or the open conversation never bumps unread', () => {
    expect(applyInboxMessage(data, msg({ sender_id: ME }), { viewerId: ME })!.pages[0].conversations[0].unread_count).toBe(1)
    expect(applyInboxMessage(data, msg({ sender_id: null }), { viewerId: ME })!.pages[0].conversations[0].unread_count).toBe(1)
    expect(
      applyInboxMessage(data, msg(), { viewerId: ME, openConversationId: 'b' })!.pages[0].conversations[0].unread_count,
    ).toBe(1)
  })

  it('ignores an event the row is already newer than (no double count)', () => {
    const once = applyInboxMessage(data, msg(), { viewerId: ME })!
    expect(applyInboxMessage(once, msg(), { viewerId: ME })).toBe(once)
  })

  it('returns null for a conversation it has never seen (caller refetches)', () => {
    expect(applyInboxMessage(data, msg({ conversation_id: 'new' }), { viewerId: ME })).toBeNull()
  })

  it('clears a conversation read, and returns the same object when nothing changes', () => {
    const read = markConversationRead(data, 'b')
    expect(read.pages[0].conversations.find((c) => c.id === 'b')!.unread_count).toBe(0)
    expect(markConversationRead(read, 'b')).toBe(read)
  })

  it('parses only well-formed channel payloads', () => {
    expect(parseInboxMessageEvent({ id: 'm', conversation_id: 'c', sender_id: null, content: 'x', created_at: 't' })).not.toBeNull()
    expect(parseInboxMessageEvent({ id: 'm', conversation_id: 'c', sender_id: 5, content: 'x', created_at: 't' })).toBeNull()
    expect(parseInboxMessageEvent({ conversation_id: 'c' })).toBeNull()
  })
})
