/**
 * Storing one chat message: the single insert path every chat surface
 * (order page, /account/messages) sends through.
 *
 * The row id is minted on the client (see message-state.ts) and sent WITH
 * the row, so a retry after a lost response is idempotent: the second
 * insert hits the primary key (23505) and we read the stored row back
 * instead of writing a duplicate.
 *
 * No React here, so the behaviour is unit-tested: send-message.test.ts.
 * RLS on `messages` stays the gate (participant / admin insert policies,
 * read-only history); nothing here widens what a client may write.
 */

import type { ChatRow } from './message-state'

export interface StoreMessageInput {
  id: string
  conversationId: string
  senderId: string
  content: string
  /** Storage path of an already-uploaded attachment, if any. */
  attachmentPath?: string | null
}

/** The slice of the Supabase browser client this needs (typed loosely, as
 *  the chat code already does for `messages` writes). */
export interface MessagesWriteClient {
  from(table: 'messages'): any
}

/** Postgres unique_violation: this id is already stored. */
export const DUPLICATE_KEY = '23505'

export async function storeMessage(client: MessagesWriteClient, input: StoreMessageInput): Promise<ChatRow> {
  const { data, error } = await client
    .from('messages')
    .insert({
      id: input.id,
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      content: input.content,
      is_read: false,
      ...(input.attachmentPath ? { attachments: [input.attachmentPath] } : {}),
    })
    .select('*')
    .single()

  if (!error) return data as ChatRow

  // An earlier attempt landed but its response was lost: read it back.
  if (error.code !== DUPLICATE_KEY) throw error
  const { data: existing } = await client.from('messages').select('*').eq('id', input.id).maybeSingle()
  if (!existing) throw error
  return existing as ChatRow
}
