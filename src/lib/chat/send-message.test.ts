import { describe, expect, it } from 'vitest'
import { DUPLICATE_KEY, storeMessage, type MessagesWriteClient } from './send-message'
import type { ChatRow } from './message-state'

type Result = { data: unknown; error: { code?: string; message?: string } | null }

/** A recording stand-in for `supabase.from('messages')`. */
function fakeClient(opts: { insert: Result; readBack?: Result }) {
  const calls: { inserted: Record<string, unknown>[]; readBackIds: unknown[] } = { inserted: [], readBackIds: [] }
  const client: MessagesWriteClient = {
    from(table: 'messages') {
      expect(table).toBe('messages')
      return {
        insert(values: Record<string, unknown>) {
          calls.inserted.push(values)
          return { select: () => ({ single: async () => opts.insert }) }
        },
        select: () => ({
          eq: (col: string, id: unknown) => {
            expect(col).toBe('id')
            calls.readBackIds.push(id)
            return { maybeSingle: async () => opts.readBack ?? { data: null, error: null } }
          },
        }),
      }
    },
  }
  return { client, calls }
}

const stored: ChatRow = {
  id: 'id-1',
  conversation_id: 'c1',
  sender_id: 'me',
  content: 'hello',
  attachments: [],
  is_read: false,
  read_at: null,
  created_at: '2026-10-05T10:00:00.000Z',
}

describe('storeMessage (the one insert path for every chat surface)', () => {
  it('inserts with the client-minted id, as the sender, unread', async () => {
    const { client, calls } = fakeClient({ insert: { data: stored, error: null } })
    const row = await storeMessage(client, { id: 'id-1', conversationId: 'c1', senderId: 'me', content: 'hello' })
    expect(row).toEqual(stored)
    expect(calls.inserted).toEqual([
      { id: 'id-1', conversation_id: 'c1', sender_id: 'me', content: 'hello', is_read: false },
    ])
  })

  it('sends the uploaded attachment path, and only when there is one', async () => {
    const { client, calls } = fakeClient({ insert: { data: stored, error: null } })
    await storeMessage(client, {
      id: 'id-1',
      conversationId: 'c1',
      senderId: 'me',
      content: 'Sent a photo',
      attachmentPath: 'order-1/chat/a.webp',
    })
    await storeMessage(client, { id: 'id-2', conversationId: 'c1', senderId: 'me', content: 'x', attachmentPath: null })
    expect(calls.inserted[0].attachments).toEqual(['order-1/chat/a.webp'])
    expect('attachments' in calls.inserted[1]).toBe(false)
  })

  it('a retry whose first attempt already landed (23505) reads the stored row back instead of duplicating', async () => {
    const { client, calls } = fakeClient({
      insert: { data: null, error: { code: DUPLICATE_KEY } },
      readBack: { data: stored, error: null },
    })
    const row = await storeMessage(client, { id: 'id-1', conversationId: 'c1', senderId: 'me', content: 'hello' })
    expect(row).toEqual(stored)
    expect(calls.inserted).toHaveLength(1)
    expect(calls.readBackIds).toEqual(['id-1'])
  })

  it('23505 with nothing readable (not mine / not visible) is a failure, not a success', async () => {
    const dup = { code: DUPLICATE_KEY }
    const { client } = fakeClient({ insert: { data: null, error: dup } })
    await expect(
      storeMessage(client, { id: 'id-1', conversationId: 'c1', senderId: 'me', content: 'hello' }),
    ).rejects.toBe(dup)
  })

  it('any other error (RLS refusal, length check) throws and never reads back', async () => {
    const rls = { code: '42501', message: 'new row violates row-level security policy' }
    const { client, calls } = fakeClient({ insert: { data: null, error: rls } })
    await expect(
      storeMessage(client, { id: 'id-1', conversationId: 'c1', senderId: 'me', content: 'hello' }),
    ).rejects.toBe(rls)
    expect(calls.readBackIds).toEqual([])
  })
})
