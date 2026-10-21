import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CHAT_REACTIONS, reactionIntent, removeReaction, summarizeReactions, upsertReaction, type ReactionRow } from './reactions'

const row = (message_id: string, user_id: string, emoji: string): ReactionRow => ({
  message_id, user_id, emoji, conversation_id: 'c1', created_at: '2026-10-21T00:00:00Z',
})

describe('chat reactions', () => {
  it('the six emoji are exactly the DB CHECK (same code points, ❤️ included)', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261021222022_chat_replies_reactions_broadcast.sql'), 'utf8')
    const check = sql.match(/check \(emoji in \(([^)]*)\)\)/)?.[1] ?? ''
    const inDb = [...check.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(inDb).toEqual([...CHAT_REACTIONS])
    expect([...CHAT_REACTIONS[1]].map((c) => c.codePointAt(0)!.toString(16))).toEqual(['2764', 'fe0f'])
  })

  it('one reaction per person per message: a new one replaces the old', () => {
    const rows = upsertReaction([row('m1', 'u1', '👍'), row('m1', 'u2', '😂')], row('m1', 'u1', '❤️'))
    expect(rows.map((r) => `${r.user_id}:${r.emoji}`).sort()).toEqual(['u1:❤️', 'u2:😂'])
    expect(removeReaction(rows, 'm1', 'u1').map((r) => r.user_id)).toEqual(['u2'])
  })

  it('chips count per emoji, mark the viewer\'s own, keep the picker order', () => {
    const rows = [row('m1', 'u1', '😂'), row('m1', 'u2', '👍'), row('m1', 'u3', '😂'), row('m2', 'u1', '🙏')]
    expect(summarizeReactions(rows, 'm1', 'u3')).toEqual([
      { emoji: '👍', count: 1, mine: false },
      { emoji: '😂', count: 2, mine: true },
    ])
  })

  it('tapping: add when none, remove the same one, change to another', () => {
    expect(reactionIntent(null, '👍')).toBe('add')
    expect(reactionIntent('👍', '👍')).toBe('remove')
    expect(reactionIntent('👍', '😢')).toBe('change')
  })
})
