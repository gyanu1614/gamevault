/**
 * The one thread read: a conversation's messages with their reactions
 * embedded (message_reactions.message_id FK), so a refresh is ONE request.
 * RLS applies to both tables. The integration guard runs this exact select
 * as a participant (chat-reply-reactions.guard.integration.test.ts).
 */

import type { ChatRow } from './message-state'
import type { ReactionRow } from './reactions'

export const THREAD_SELECT = '*, message_reactions(message_id, user_id, conversation_id, emoji, created_at)'

type ThreadRow = ChatRow & { message_reactions?: ReactionRow[] | null }

/** Split the embedded read into the thread rows and a flat reaction list. */
export function splitThreadRows(data: unknown[] | null): { rows: ChatRow[]; reactions: ReactionRow[] } {
  const rows: ChatRow[] = []
  const reactions: ReactionRow[] = []
  for (const { message_reactions: r, ...row } of (data ?? []) as ThreadRow[]) {
    rows.push(row)
    if (r) reactions.push(...r)
  }
  return { rows, reactions }
}
