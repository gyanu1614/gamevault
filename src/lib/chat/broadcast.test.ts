import { describe, expect, it } from 'vitest'
import { chatTopic, parseChatBroadcast } from './broadcast'

const message = {
  id: 'm1', conversation_id: 'c1', sender_id: 'u1', content: 'hi', attachments: [],
  is_read: false, read_at: null, created_at: '2026-10-21T10:00:00Z', reply_to_id: null,
}
const reaction = { message_id: 'm1', user_id: 'u2', conversation_id: 'c1', emoji: '👍', created_at: '2026-10-21T10:01:00Z' }

/** The shape realtime-js hands an on('broadcast') listener for realtime.broadcast_changes(). */
const wire = (event: string, payload: Record<string, unknown>) => ({ type: 'broadcast', event, payload })

describe('chat broadcast (realtime.broadcast_changes → chat:<conversation id>)', () => {
  it('the topic is chat:<conversation id> (the realtime.messages policy matches on it)', () => {
    expect(chatTopic('5b9f3c3e-2f3a-4c8e-9a51-0d6f2b7c1e44')).toBe('chat:5b9f3c3e-2f3a-4c8e-9a51-0d6f2b7c1e44')
  })

  it('a new or updated message', () => {
    expect(parseChatBroadcast(wire('message', { table: 'messages', operation: 'INSERT', record: message, old_record: null }))).toEqual({
      kind: 'message', op: 'INSERT', row: message,
    })
    expect(parseChatBroadcast(wire('message', { table: 'messages', operation: 'UPDATE', record: { ...message, is_read: true }, old_record: message }))).toEqual({
      kind: 'message', op: 'UPDATE', row: { ...message, is_read: true },
    })
  })

  it('a reaction added, changed, removed', () => {
    expect(parseChatBroadcast(wire('reaction', { table: 'message_reactions', operation: 'INSERT', record: reaction, old_record: null }))).toEqual({
      kind: 'reaction', row: reaction,
    })
    expect(parseChatBroadcast(wire('reaction', { table: 'message_reactions', operation: 'UPDATE', record: { ...reaction, emoji: '😂' }, old_record: reaction }))).toEqual({
      kind: 'reaction', row: { ...reaction, emoji: '😂' },
    })
    expect(parseChatBroadcast(wire('reaction', { table: 'message_reactions', operation: 'DELETE', record: null, old_record: reaction }))).toEqual({
      kind: 'reaction-removed', messageId: 'm1', userId: 'u2',
    })
  })

  it('ignores anything else (other tables, a message DELETE, junk)', () => {
    expect(parseChatBroadcast(wire('message', { table: 'orders', operation: 'INSERT', record: { id: 'o1' }, old_record: null }))).toBeNull()
    expect(parseChatBroadcast(wire('message', { table: 'messages', operation: 'DELETE', record: null, old_record: message }))).toBeNull()
    expect(parseChatBroadcast(wire('message', { table: 'messages', operation: 'INSERT', record: null, old_record: null }))).toBeNull()
    expect(parseChatBroadcast(null)).toBeNull()
    expect(parseChatBroadcast({ payload: 'x' })).toBeNull()
  })
})
