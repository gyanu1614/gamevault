'use client'

import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'

const WRITE_DELAY_MS = 120

/**
 * A search box whose words are kept in the page's address (owner, 2026-11-06: typing
 * "Strawberry" stuck after the S, because every letter waited for the address to change
 * and come back). The box owns what's typed, so typing never waits and never redraws the
 * table. The address follows a moment later.
 *
 * It follows the address back when something else changes it, like a Clear button or a
 * menu link. A word we wrote ourselves can arrive late, after more typing: by then the
 * address already holds something newer, so that word is ignored.
 *
 * @param value the search as the page reads it from the address
 * @param param the address key it lives under
 * @param onCommit writes the search to the address
 */
export function UrlSearchInput({
  value,
  param,
  onCommit,
  ...input
}: {
  value: string
  param: string
  onCommit: (next: string) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(value)
  const sent = useRef(value)
  const commit = useRef(onCommit)
  commit.current = onCommit

  useEffect(() => {
    if (value === sent.current) return
    const inAddress = new URLSearchParams(window.location.search).get(param) ?? ''
    if (value !== inAddress) return
    sent.current = value
    setText(value)
  }, [value, param])

  useEffect(() => {
    if (text === sent.current) return
    const timer = setTimeout(() => {
      sent.current = text
      commit.current(text)
    }, WRITE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text])

  return <input {...input} value={text} onChange={(e) => setText(e.target.value)} />
}
