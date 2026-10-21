import { describe, expect, it } from 'vitest'
import { splitThreadRows } from './thread-read'

describe('thread read (messages + embedded reactions, one request)', () => {
  it('strips the embed off each message and flattens the reactions', () => {
    const r = { message_id: 'm1', user_id: 'u2', conversation_id: 'c1', emoji: '👍', created_at: 't' }
    const { rows, reactions } = splitThreadRows([
      { id: 'm1', conversation_id: 'c1', sender_id: 'u1', content: 'a', is_read: false, read_at: null, created_at: 't1', message_reactions: [r] },
      { id: 'm2', conversation_id: 'c1', sender_id: 'u2', content: 'b', is_read: false, read_at: null, created_at: 't2', message_reactions: [] },
    ])
    expect(rows.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(rows[0]).not.toHaveProperty('message_reactions')
    expect(reactions).toEqual([r])
  })

  it('an empty or missing result is an empty thread', () => {
    expect(splitThreadRows(null)).toEqual({ rows: [], reactions: [] })
  })
})
