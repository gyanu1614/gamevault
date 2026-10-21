/**
 * Chat reactions: the six emoji a person can put on a message, one per
 * person per message (tap another to change it, the same one to remove it).
 *
 * The list is the DB's CHECK on message_reactions.emoji
 * (20261021222022_chat_replies_reactions_broadcast.sql); reactions.test.ts
 * keeps the two in step. ❤️ is two code points (U+2764 U+FE0F): send it
 * exactly as written here.
 */

export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const
export type ChatReactionEmoji = (typeof CHAT_REACTIONS)[number]

/** Screen-reader names for the six emoji. */
export const REACTION_LABELS: Record<ChatReactionEmoji, string> = {
  '👍': 'Like',
  '❤️': 'Love',
  '😂': 'Haha',
  '😮': 'Wow',
  '😢': 'Sad',
  '🙏': 'Thanks',
}

export function reactionLabel(emoji: string): string {
  return isChatReaction(emoji) ? REACTION_LABELS[emoji] : emoji
}

export interface ReactionRow {
  message_id: string
  user_id: string
  conversation_id: string
  emoji: string
  created_at: string
}

export interface ReactionSummary {
  emoji: string
  count: number
  /** The viewer's own reaction is this emoji. */
  mine: boolean
}

export function isChatReaction(value: string): value is ChatReactionEmoji {
  return (CHAT_REACTIONS as readonly string[]).includes(value)
}

/** Insert or replace `row` (one per person per message). */
export function upsertReaction(rows: ReactionRow[], row: ReactionRow): ReactionRow[] {
  const rest = rows.filter((r) => !(r.message_id === row.message_id && r.user_id === row.user_id))
  return [...rest, row]
}

export function removeReaction(rows: ReactionRow[], messageId: string, userId: string): ReactionRow[] {
  return rows.filter((r) => !(r.message_id === messageId && r.user_id === userId))
}

/** Chips under one message, in the picker's order. */
export function summarizeReactions(rows: ReactionRow[], messageId: string, viewerId: string): ReactionSummary[] {
  const counts = new Map<string, ReactionSummary>()
  for (const r of rows) {
    if (r.message_id !== messageId) continue
    const s = counts.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false }
    s.count += 1
    if (r.user_id === viewerId) s.mine = true
    counts.set(r.emoji, s)
  }
  const order = (e: string) => {
    const i = (CHAT_REACTIONS as readonly string[]).indexOf(e)
    return i === -1 ? CHAT_REACTIONS.length : i
  }
  return [...counts.values()].sort((a, b) => order(a.emoji) - order(b.emoji))
}

/** What tapping `emoji` does, given the viewer's current reaction on that message. */
export function reactionIntent(current: string | null, emoji: string): 'add' | 'change' | 'remove' {
  if (current === null) return 'add'
  return current === emoji ? 'remove' : 'change'
}
