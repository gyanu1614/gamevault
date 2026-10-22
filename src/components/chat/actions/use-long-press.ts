'use client'

import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react'

/** How long a finger rests on a message before its actions open. */
const HOLD_MS = 420
/** A finger that moves further than this is scrolling, not holding. */
const SLOP_PX = 10

/**
 * Touch long-press on a message (WhatsApp / iMessage / Messenger pattern).
 * Touch only: a mouse gets the hover toolbar instead. A scroll cancels it
 * (the browser takes the pointer and fires pointercancel), and the tap that
 * ends a long-press never also follows a link inside the bubble.
 */
export function useLongPress(onLongPress: () => void, enabled: boolean) {
  const timer = useRef<number | null>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const callback = useRef(onLongPress)
  callback.current = onLongPress

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    origin.current = null
  }, [])
  useEffect(() => clear, [clear])

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (!enabled || e.pointerType !== 'touch') return
      fired.current = false
      origin.current = { x: e.clientX, y: e.clientY }
      timer.current = window.setTimeout(() => {
        timer.current = null
        fired.current = true
        navigator.vibrate?.(8)
        callback.current()
      }, HOLD_MS)
    },
    [enabled],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const o = origin.current
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > SLOP_PX) clear()
    },
    [clear],
  )

  // The OS menu (copy / look up / link preview) would open on the same hold.
  const onContextMenu = useCallback((e: MouseEvent) => {
    if (fired.current || origin.current) e.preventDefault()
  }, [])

  const onClickCapture = useCallback((e: MouseEvent) => {
    if (!fired.current) return
    fired.current = false
    e.preventDefault()
    e.stopPropagation()
  }, [])

  if (!enabled) return {}
  return { onPointerDown, onPointerMove, onPointerUp: clear, onPointerCancel: clear, onContextMenu, onClickCapture }
}
