/**
 * Live chat delivery: what arrives on the private topic chat:<conversation id>.
 *
 * Migration 20261021222022 broadcasts every messages INSERT/UPDATE (event
 * 'message') and every message_reactions INSERT/UPDATE/DELETE (event
 * 'reaction') with realtime.broadcast_changes(). realtime-js hands the
 * listener `{ type, event, payload: { table, operation, record, old_record } }`.
 *
 * Pure (no Supabase) so the shapes are unit-tested: broadcast.test.ts. The
 * join itself (private channel, RLS on realtime.messages) is proven on a
 * real stack by chat-reply-reactions.guard.integration.test.ts.
 */

import type { ChatRow } from './message-state'
import type { ReactionRow } from './reactions'

export function chatTopic(conversationId: string): string {
  return `chat:${conversationId}`
}

export type ChatBroadcast =
  /** INSERT = a new message (mine echoed back, or theirs); UPDATE = a read receipt. */
  | { kind: 'message'; op: 'INSERT' | 'UPDATE'; row: ChatRow }
  | { kind: 'reaction'; row: ReactionRow }
  | { kind: 'reaction-removed'; messageId: string; userId: string }

type Wire = { table?: unknown; operation?: unknown; record?: unknown; old_record?: unknown }

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function parseChatBroadcast(message: unknown): ChatBroadcast | null {
  if (!isObject(message) || !isObject(message.payload)) return null
  const { table, operation, record, old_record: old } = message.payload as Wire

  if (table === 'messages' && (operation === 'INSERT' || operation === 'UPDATE')) {
    return isObject(record) && typeof record.id === 'string' ? { kind: 'message', op: operation, row: record as unknown as ChatRow } : null
  }
  if (table === 'message_reactions') {
    if (operation === 'DELETE') {
      return isObject(old) && typeof old.message_id === 'string' && typeof old.user_id === 'string'
        ? { kind: 'reaction-removed', messageId: old.message_id, userId: old.user_id }
        : null
    }
    if (operation === 'INSERT' || operation === 'UPDATE') {
      return isObject(record) && typeof record.message_id === 'string'
        ? { kind: 'reaction', row: record as unknown as ReactionRow }
        : null
    }
  }
  return null
}
