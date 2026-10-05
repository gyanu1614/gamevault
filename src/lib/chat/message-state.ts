/**
 * Chat thread state: optimistic sends, realtime merge, read receipts.
 *
 * Pure functions (no React, no Supabase) so the order chat's behaviour is
 * unit-tested: message-state.test.ts.
 *
 * One identity per message. The client mints the row id (a UUID) BEFORE the
 * insert and sends it with the row, so the optimistic bubble, the realtime
 * echo of the insert and the insert's own response all carry the same id:
 *  - the React key never changes → the bubble settles in place, no re-mount;
 *  - dedupe is by id, never by content;
 *  - a retry after a lost response is idempotent (the second insert hits the
 *    primary key instead of creating a duplicate).
 */

import { isSystemMessage } from './system-notice'

/** A `messages` row as the client reads it. */
export interface ChatRow {
  id: string
  conversation_id: string
  /** NULL = DropMarket system notice. */
  sender_id: string | null
  content: string
  attachments?: string[] | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export type LocalStatus = 'sending' | 'failed'

/** A file picked on this device, shown until/instead of the signed copy. */
export interface LocalFile {
  kind: 'image' | 'pdf'
  /** Object URL for images; PDFs show a chip. */
  url?: string
}

export interface ChatMessage extends ChatRow {
  /** Only on an optimistic message the server has not confirmed. */
  local_status?: LocalStatus
  /** Local previews of the attachment (kept after the ack: no reload flash). */
  local_files?: LocalFile[]
}

export type DeliveryState = 'sending' | 'failed' | 'sent' | 'read'

/** The fields the delivery status is derived from. */
export interface DeliveryFields {
  local_status?: LocalStatus
  is_read: boolean
  read_at?: string | null
}

function byCreatedAt(a: ChatRow, b: ChatRow): number {
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
}

function sameRow(a: ChatMessage, b: ChatRow): boolean {
  return (
    a.local_status === undefined &&
    a.content === b.content &&
    a.sender_id === b.sender_id &&
    a.is_read === b.is_read &&
    a.read_at === b.read_at &&
    a.created_at === b.created_at &&
    JSON.stringify(a.attachments ?? []) === JSON.stringify(b.attachments ?? [])
  )
}

/** Append an optimistic message (no-op if that id is already there). */
export function addOptimistic(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  if (list.some((m) => m.id === msg.id)) return list
  return [...list, msg]
}

/**
 * Merge one server row: the insert's response, a realtime INSERT (the other
 * party's message or the echo of mine) or a realtime UPDATE (read receipt).
 * An existing entry is updated IN PLACE (local status cleared, local
 * preview kept); a new row goes after the last confirmed row that is not
 * newer than it, ahead of any of my still-pending messages.
 */
export function upsertRow(list: ChatMessage[], incoming: ChatRow): ChatMessage[] {
  const at = list.findIndex((m) => m.id === incoming.id)
  if (at !== -1) {
    const current = list[at]
    if (sameRow(current, incoming)) return list
    const next = list.slice()
    next[at] = { ...current, ...incoming, local_status: undefined }
    return next
  }
  let insertAt = list.length
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]
    if (m.local_status !== undefined || byCreatedAt(m, incoming) > 0) insertAt = i
    else break
  }
  const next = list.slice()
  next.splice(insertAt, 0, { ...incoming })
  return next
}

/** Move an optimistic message between 'sending' and 'failed'. A confirmed
 *  message is never put back into a local state. */
export function markLocalStatus(list: ChatMessage[], id: string, status: LocalStatus): ChatMessage[] {
  const at = list.findIndex((m) => m.id === id)
  if (at === -1 || list[at].local_status === undefined || list[at].local_status === status) return list
  const next = list.slice()
  next[at] = { ...list[at], local_status: status }
  return next
}

/** Patch fields of one message (e.g. the uploaded attachment path). */
export function patchMessage(list: ChatMessage[], id: string, patch: Partial<ChatMessage>): ChatMessage[] {
  const at = list.findIndex((m) => m.id === id)
  if (at === -1) return list
  const next = list.slice()
  next[at] = { ...list[at], ...patch }
  return next
}

/** Drop one message (an unsent one the user discards). */
export function removeMessage(list: ChatMessage[], id: string): ChatMessage[] {
  return list.some((m) => m.id === id) ? list.filter((m) => m.id !== id) : list
}

/**
 * Reconcile with a full refetch (initial load, channel (re)subscribed, tab
 * visible again, safety poll). The server rows are the truth, in created_at
 * order; local previews carry over by id; optimistic messages the server
 * does not have yet stay at the end. Returns the SAME array when nothing
 * changed so an idle poll does not re-render the thread.
 */
export function mergeServer(list: ChatMessage[], rows: ChatRow[]): ChatMessage[] {
  const byId = new Map(list.map((m) => [m.id, m]))
  const serverIds = new Set(rows.map((r) => r.id))
  const confirmed: ChatMessage[] = rows
    .slice()
    .sort(byCreatedAt)
    .map((r) => {
      const local = byId.get(r.id)
      if (local && sameRow(local, r)) return local
      return local?.local_files ? { ...r, local_files: local.local_files } : { ...r }
    })
  const stillLocal = list.filter((m) => m.local_status !== undefined && !serverIds.has(m.id))
  const next = [...confirmed, ...stillLocal]
  if (next.length === list.length && next.every((m, i) => m === list[i])) return list
  return next
}

/** Ids of the other party's messages I have not read (system notices and
 *  my own messages are never "unread" for me). */
export function unreadFromOthers(list: ChatMessage[], userId: string): string[] {
  return list
    .filter((m) => !isSystemMessage(m.sender_id) && m.sender_id !== userId && !m.is_read && !m.read_at)
    .map((m) => m.id)
}

/** Stamp the given messages read locally (after the server update). */
export function markReadLocally(list: ChatMessage[], ids: string[], readAt: string): ChatMessage[] {
  if (ids.length === 0) return list
  const set = new Set(ids)
  return list.map((m) => (set.has(m.id) ? { ...m, is_read: true, read_at: m.read_at ?? readAt } : m))
}

/** The newest message I wrote (where the status label sits). */
export function lastOwnMessageId(
  list: ReadonlyArray<Pick<ChatRow, 'id' | 'sender_id'>>,
  userId: string,
): string | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]
    if (!isSystemMessage(m.sender_id) && m.sender_id === userId) return m.id
  }
  return null
}

export function deliveryState(m: DeliveryFields): DeliveryState {
  if (m.local_status) return m.local_status
  return m.is_read || m.read_at ? 'read' : 'sent'
}

/** "Sending…" → "Sent" → "Read 2m ago"; "Not sent" on failure. */
export function statusLabel(m: DeliveryFields, now: Date = new Date()): string {
  const state = deliveryState(m)
  if (state === 'sending') return 'Sending…'
  if (state === 'failed') return 'Not sent'
  if (state === 'sent') return 'Sent'
  if (!m.read_at) return 'Read'
  const readAt = new Date(m.read_at)
  const mins = Math.floor((now.getTime() - readAt.getTime()) / 60_000)
  if (mins < 1) return 'Read just now'
  if (mins < 60) return `Read ${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Read ${hours}h ago`
  return `Read ${readAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}
