/**
 * The signed-in user's live channel: ONE private broadcast topic, user:<id>,
 * shared by everything on the page that wants live updates (navbar bell,
 * Messages badge, inbox, auth provider, order page).
 *
 * Database triggers send to it (migration 20261102161908_user_channel_broadcast):
 *   message            new chat message in one of my conversations
 *   notification       new notifications row for me
 *   seller_application my application was filed / changed status
 *   profile            my role / shop / seller fields changed
 *   order              an order I'm party to changed
 * Only the user themself may join (RLS on realtime.messages, checked once at
 * join). It replaced Postgres Changes on five tables, which re-checked RLS
 * per subscriber per row inside the database (incident 2026-11-02).
 *
 * One channel per tab no matter how many listeners: the first listener
 * joins, the last one leaving closes it after a short grace (so a route
 * change does not re-join). A missed event is covered by each consumer's
 * focus refetch / slow poll, and every RE-join (after a dropped socket) is
 * reported through onUserChannelRejoined so consumers can re-sync. The first
 * join is not: consumers have just fetched.
 */

import type { RealtimeChannel } from '@supabase/supabase-js'

export const USER_CHANNEL_EVENTS = ['message', 'notification', 'seller_application', 'profile', 'order'] as const
export type UserChannelEvent = (typeof USER_CHANNEL_EVENTS)[number]
export type UserChannelPayload = Record<string, unknown>
export type UserChannelListener = (payload: UserChannelPayload) => void

/** Leave the channel this long after its last listener goes (route changes). */
export const USER_CHANNEL_CLOSE_GRACE_MS = 5_000

export function userTopic(userId: string): string {
  return `user:${userId}`
}

/** What realtime-js hands a broadcast listener: { type, event, payload }. */
export function parseUserChannelMessage(message: unknown): { event: UserChannelEvent; payload: UserChannelPayload } | null {
  if (typeof message !== 'object' || message === null) return null
  const { event, payload } = message as { event?: unknown; payload?: unknown }
  if (typeof event !== 'string' || !(USER_CHANNEL_EVENTS as readonly string[]).includes(event)) return null
  if (typeof payload !== 'object' || payload === null) return null
  return { event: event as UserChannelEvent, payload: payload as UserChannelPayload }
}

interface Entry {
  userId: string
  channel: RealtimeChannel | null
  removeChannel: ((c: RealtimeChannel) => unknown) | null
  listeners: Map<UserChannelEvent, Set<UserChannelListener>>
  joinedListeners: Set<() => void>
  joins: number
  closeTimer: ReturnType<typeof setTimeout> | null
  closed: boolean
}

let current: Entry | null = null

function listenerCount(entry: Entry): number {
  let n = entry.joinedListeners.size
  for (const set of entry.listeners.values()) n += set.size
  return n
}

/** Channels of a previous user, left only once the next user's channel is
 *  created: removing a client's last channel closes its socket, and a join
 *  racing that reconnect is dropped by realtime-js (10 s timeout + retry). */
let retiring: Entry[] = []

function removeEntryChannel(entry: Entry) {
  if (entry.channel && entry.removeChannel) void entry.removeChannel(entry.channel)
}

function close(entry: Entry, { deferRemoval = false }: { deferRemoval?: boolean } = {}) {
  entry.closed = true
  if (entry.closeTimer) clearTimeout(entry.closeTimer)
  if (deferRemoval) retiring.push(entry)
  else removeEntryChannel(entry)
  if (current === entry) current = null
}

function removeRetiring() {
  const done = retiring
  retiring = []
  done.forEach(removeEntryChannel)
}

async function join(entry: Entry) {
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  // A private channel joined with the anonymous key is refused: the socket
  // must carry the session first.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (entry.closed) return
  if (session?.access_token) supabase.realtime.setAuth(session.access_token)

  entry.removeChannel = (c) => supabase.removeChannel(c)
  entry.channel = supabase
    .channel(userTopic(entry.userId), { config: { private: true } })
    .on('broadcast', { event: '*' }, (message) => {
      const parsed = parseUserChannelMessage(message)
      if (!parsed) return
      for (const listener of Array.from(entry.listeners.get(parsed.event) ?? [])) {
        try {
          listener(parsed.payload)
        } catch (err) {
          console.error(`[user-channel] ${parsed.event} listener failed:`, err)
        }
      }
    })
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      entry.joins += 1
      if (entry.joins === 1) return
      for (const listener of Array.from(entry.joinedListeners)) listener()
    })
  // The new channel holds the socket now: the previous user's can go.
  removeRetiring()
}

function entryFor(userId: string): Entry {
  if (current && current.userId !== userId) close(current, { deferRemoval: true })
  if (!current) {
    const entry: Entry = {
      userId,
      channel: null,
      removeChannel: null,
      listeners: new Map(),
      joinedListeners: new Set(),
      joins: 0,
      closeTimer: null,
      closed: false,
    }
    current = entry
    void join(entry)
      .catch((err) => console.error('[user-channel] join failed:', err))
      .finally(removeRetiring)
  }
  if (current.closeTimer) {
    clearTimeout(current.closeTimer)
    current.closeTimer = null
  }
  return current
}

function release(entry: Entry) {
  if (entry.closed || listenerCount(entry) > 0 || entry.closeTimer) return
  entry.closeTimer = setTimeout(() => {
    entry.closeTimer = null
    if (listenerCount(entry) === 0) close(entry)
  }, USER_CHANNEL_CLOSE_GRACE_MS)
}

/** Listen for one event on the user's channel. Returns the unsubscribe. */
export function subscribeUserChannel(userId: string, event: UserChannelEvent, listener: UserChannelListener): () => void {
  const entry = entryFor(userId)
  let set = entry.listeners.get(event)
  if (!set) {
    set = new Set()
    entry.listeners.set(event, set)
  }
  set.add(listener)
  return () => {
    entry.listeners.get(event)?.delete(listener)
    release(entry)
  }
}

/** Called on every RE-join — re-sync whatever a dropped socket may have missed. */
export function onUserChannelRejoined(userId: string, listener: () => void): () => void {
  const entry = entryFor(userId)
  entry.joinedListeners.add(listener)
  return () => {
    entry.joinedListeners.delete(listener)
    release(entry)
  }
}
