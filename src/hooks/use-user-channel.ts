'use client'

import { useEffect, useRef } from 'react'
import {
  onUserChannelRejoined,
  subscribeUserChannel,
  type UserChannelEvent,
  type UserChannelListener,
} from '@/lib/realtime/user-channel'

/**
 * Run `handler` for every `event` on the signed-in user's live channel
 * (lib/realtime/user-channel). The handler is read through a ref, so an
 * inline arrow does not re-subscribe on every render.
 */
export function useUserChannelEvent(
  userId: string | null | undefined,
  event: UserChannelEvent,
  handler: UserChannelListener,
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  useEffect(() => {
    if (!userId) return
    return subscribeUserChannel(userId, event, (payload) => handlerRef.current(payload))
  }, [userId, event])
}

/** Run `handler` each time the channel RE-joins after a drop — re-sync. */
export function useUserChannelRejoined(userId: string | null | undefined, handler: () => void): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  useEffect(() => {
    if (!userId) return
    return onUserChannelRejoined(userId, () => handlerRef.current())
  }, [userId])
}
