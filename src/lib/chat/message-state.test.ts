import { describe, expect, it } from 'vitest'
import {
  addOptimistic,
  deliveryState,
  lastOwnMessageId,
  markLocalStatus,
  markReadLocally,
  mergeServer,
  optimisticMessage,
  patchMessage,
  statusLabel,
  unreadFromOthers,
  upsertRow,
  type ChatMessage,
  type ChatRow,
} from './message-state'

const ME = 'me'
const THEM = 'them'

function row(id: string, over: Partial<ChatRow> = {}): ChatRow {
  return {
    id,
    conversation_id: 'c1',
    sender_id: ME,
    content: `msg ${id}`,
    attachments: [],
    is_read: false,
    read_at: null,
    created_at: `2026-10-04T10:00:0${id.replace(/\D/g, '') || '0'}.000Z`,
    ...over,
  }
}

function pending(id: string, over: Partial<ChatMessage> = {}): ChatMessage {
  return { ...row(id), local_status: 'sending', ...over }
}

describe('optimistic merge', () => {
  it('appends an optimistic message once (same id twice is a no-op)', () => {
    const a = addOptimistic([], pending('1'))
    expect(addOptimistic(a, pending('1'))).toBe(a)
    expect(a).toHaveLength(1)
  })

  it('the server ack settles the SAME entry in place: no new id, no re-order, local status cleared', () => {
    const list = addOptimistic([row('1', { sender_id: THEM })], pending('2', { local_files: [{ kind: 'image', url: 'blob:x' }] }))
    const acked = upsertRow(list, row('2', { created_at: '2026-10-04T09:00:00.000Z' }))
    expect(acked.map((m) => m.id)).toEqual(['1', '2'])
    expect(acked[1].local_status).toBeUndefined()
    // The local preview survives the ack so the picture does not reload.
    expect(acked[1].local_files).toEqual([{ kind: 'image', url: 'blob:x' }])
  })

  it('the realtime echo of my own insert never duplicates the optimistic bubble', () => {
    let list = addOptimistic([], pending('1'))
    list = upsertRow(list, row('1')) // realtime INSERT echo
    list = upsertRow(list, row('1')) // insert().select() ack
    expect(list).toHaveLength(1)
    expect(list[0].local_status).toBeUndefined()
  })

  it("an incoming message from the other party lands before my still-pending ones", () => {
    let list = addOptimistic([row('1')], pending('3'))
    list = upsertRow(list, row('2', { sender_id: THEM }))
    expect(list.map((m) => m.id)).toEqual(['1', '2', '3'])
  })

  it('an UPDATE (read receipt) merges into the existing row', () => {
    const list = [row('1')]
    const next = upsertRow(list, row('1', { is_read: true, read_at: '2026-10-04T10:05:00.000Z' }))
    expect(next[0].is_read).toBe(true)
    expect(next[0].read_at).toBe('2026-10-04T10:05:00.000Z')
  })

  it('failed → retry → acked keeps one entry', () => {
    let list = addOptimistic([], pending('1'))
    list = markLocalStatus(list, '1', 'failed')
    expect(list[0].local_status).toBe('failed')
    list = markLocalStatus(list, '1', 'sending')
    expect(list[0].local_status).toBe('sending')
    list = upsertRow(list, row('1'))
    expect(list).toHaveLength(1)
    expect(list[0].local_status).toBeUndefined()
  })

  it('markLocalStatus never puts a confirmed message back into a local state', () => {
    const list = [row('1')]
    expect(markLocalStatus(list, '1', 'failed')).toBe(list)
  })

  it('patchMessage sets the uploaded attachment path on the optimistic entry', () => {
    const list = patchMessage([pending('1')], '1', { attachments: ['order/1/a.png'] })
    expect(list[0].attachments).toEqual(['order/1/a.png'])
  })
})

describe('mergeServer (refetch on reconnect / visibility / poll)', () => {
  it('takes the server rows as truth, in created_at order', () => {
    const merged = mergeServer([row('2')], [row('2'), row('1', { sender_id: THEM })])
    expect(merged.map((m) => m.id)).toEqual(['1', '2'])
  })

  it('keeps pending + failed optimistic messages the server does not have yet, at the end', () => {
    const list = [row('1'), pending('5'), pending('6', { local_status: 'failed' })]
    const merged = mergeServer(list, [row('1'), row('2', { sender_id: THEM })])
    expect(merged.map((m) => [m.id, m.local_status])).toEqual([
      ['1', undefined],
      ['2', undefined],
      ['5', 'sending'],
      ['6', 'failed'],
    ])
  })

  it('confirms a pending message the server already has (dedupe by id) and keeps its preview', () => {
    const list = [pending('1', { local_files: [{ kind: 'image', url: 'blob:y' }] })]
    const merged = mergeServer(list, [row('1')])
    expect(merged).toHaveLength(1)
    expect(merged[0].local_status).toBeUndefined()
    expect(merged[0].local_files).toEqual([{ kind: 'image', url: 'blob:y' }])
  })

  it('returns the same array when nothing changed (no re-render on an idle poll)', () => {
    const list = [row('1'), row('2', { sender_id: THEM })]
    expect(mergeServer(list, [row('1'), row('2', { sender_id: THEM })])).toBe(list)
  })
})

describe('read tracking', () => {
  it('unreadFromOthers lists only the other party’s unread, never mine or system notices', () => {
    const list: ChatMessage[] = [
      row('1', { sender_id: THEM }),
      row('2', { sender_id: THEM, is_read: true, read_at: '2026-10-04T10:00:00.000Z' }),
      row('3'),
      row('4', { sender_id: null, content: '{"type":"order_delivered"}' }),
    ]
    expect(unreadFromOthers(list, ME)).toEqual(['1'])
  })

  it('markReadLocally stamps only the given ids', () => {
    const list = markReadLocally([row('1', { sender_id: THEM }), row('2')], ['1'], '2026-10-04T10:09:00.000Z')
    expect(list[0]).toMatchObject({ is_read: true, read_at: '2026-10-04T10:09:00.000Z' })
    expect(list[1].is_read).toBe(false)
  })

  it('lastOwnMessageId skips the other party and system notices', () => {
    const list: ChatMessage[] = [row('1'), row('2', { sender_id: THEM }), row('3', { sender_id: null })]
    expect(lastOwnMessageId(list, ME)).toBe('1')
    expect(lastOwnMessageId([row('1', { sender_id: THEM })], ME)).toBeNull()
  })
})

describe('delivery state + label', () => {
  const now = new Date('2026-10-04T10:10:00.000Z')

  it('sending → sent → read', () => {
    expect(deliveryState(pending('1'))).toBe('sending')
    expect(deliveryState(pending('1', { local_status: 'failed' }))).toBe('failed')
    expect(deliveryState(row('1'))).toBe('sent')
    expect(deliveryState(row('1', { is_read: true }))).toBe('read')
    expect(deliveryState(row('1', { read_at: '2026-10-04T10:00:00.000Z' }))).toBe('read')
  })

  it('labels', () => {
    expect(statusLabel(pending('1'), now)).toBe('Sending…')
    expect(statusLabel(pending('1', { local_status: 'failed' }), now)).toBe('Not sent')
    expect(statusLabel(row('1'), now)).toBe('Sent')
    expect(statusLabel(row('1', { is_read: true }), now)).toBe('Read')
    expect(statusLabel(row('1', { is_read: true, read_at: '2026-10-04T10:09:40.000Z' }), now)).toBe('Read just now')
    expect(statusLabel(row('1', { is_read: true, read_at: '2026-10-04T10:08:00.000Z' }), now)).toBe('Read 2m ago')
    expect(statusLabel(row('1', { is_read: true, read_at: '2026-10-04T07:00:00.000Z' }), now)).toBe('Read 3h ago')
    expect(statusLabel(row('1', { is_read: true, read_at: '2026-10-01T07:00:00.000Z' }), now)).toBe('Read Oct 1')
  })
})

describe('optimisticMessage (instant send, both chat surfaces)', () => {
  const now = new Date('2026-10-04T10:00:05.000Z')
  const bubble = optimisticMessage({ id: 'x1', conversationId: 'c1', senderId: ME, content: 'hi', now })

  it('is a pending, unread bubble carrying the id the insert will use', () => {
    expect(bubble).toMatchObject({
      id: 'x1',
      conversation_id: 'c1',
      sender_id: ME,
      content: 'hi',
      attachments: [],
      is_read: false,
      read_at: null,
      created_at: '2026-10-04T10:00:05.000Z',
      local_status: 'sending',
    })
    expect(deliveryState(bubble)).toBe('sending')
    expect(statusLabel(bubble)).toBe('Sending…')
  })

  it('send → insert ack → realtime echo → read receipt: one entry the whole way, same position', () => {
    const before = [row('1', { sender_id: THEM })]
    let list = addOptimistic(before, bubble)
    const stored: ChatRow = { ...row('9'), id: 'x1', content: 'hi', created_at: '2026-10-04T10:00:05.100Z' }
    list = upsertRow(list, stored) // insert response
    list = upsertRow(list, stored) // realtime echo of the same row
    expect(list.map((m) => m.id)).toEqual(['1', 'x1'])
    expect(deliveryState(list[1])).toBe('sent')
    list = upsertRow(list, { ...stored, is_read: true, read_at: '2026-10-04T10:01:00.000Z' })
    expect(list.map((m) => m.id)).toEqual(['1', 'x1'])
    expect(deliveryState(list[1])).toBe('read')
  })

  it('keeps the local file preview through the ack (no reload flash)', () => {
    const withFile = optimisticMessage({
      id: 'x2',
      conversationId: 'c1',
      senderId: ME,
      content: 'Sent a photo',
      localFiles: [{ kind: 'image', url: 'blob:x' }],
      now,
    })
    const list = upsertRow([withFile], { ...row('2'), id: 'x2', content: 'Sent a photo', attachments: ['o/chat/a.webp'] })
    expect(list[0].local_files).toEqual([{ kind: 'image', url: 'blob:x' }])
    expect(list[0].attachments).toEqual(['o/chat/a.webp'])
    expect(list[0].local_status).toBeUndefined()
  })

  it('a pending bubble restored on reopening the conversation survives the refetch until the server has it', () => {
    const restored = { ...bubble, local_status: 'failed' as const }
    const merged = mergeServer([restored], [row('1', { sender_id: THEM })])
    expect(merged.map((m) => [m.id, m.local_status])).toEqual([
      ['1', undefined],
      ['x1', 'failed'],
    ])
  })
})
