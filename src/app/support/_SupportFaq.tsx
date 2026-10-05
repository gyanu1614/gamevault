'use client'

/**
 * The /support FAQ: the shared FaqCards accordion, plus a listener so the
 * help search can open a specific question. FaqCards owns its open state
 * (initial index only), so opening from outside remounts it with that index
 * as the default — then the section scrolls into view.
 */

import { useEffect, useRef, useState } from 'react'
import { FaqCards, type FaqItem } from '@/components/marketplace/FaqCards'
import { OPEN_FAQ_EVENT } from './_SupportSearch'

export function SupportFaq({ items }: { items: Array<FaqItem & { id: string }> }) {
  const [target, setTarget] = useState<{ index: number; nonce: number }>({ index: 0, nonce: 0 })
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<string>).detail
      const index = items.findIndex((item) => item.id === id)
      if (index < 0) return
      setTarget((t) => ({ index, nonce: t.nonce + 1 }))
    }
    window.addEventListener(OPEN_FAQ_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_FAQ_EVENT, onOpen)
  }, [items])

  useEffect(() => {
    if (target.nonce === 0) return
    const card = rootRef.current?.querySelectorAll('h3')[target.index]
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    card?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    card?.querySelector('button')?.focus({ preventScroll: true })
  }, [target])

  return (
    <div ref={rootRef}>
      <FaqCards
        key={target.nonce}
        items={items.map(({ q, a }) => ({ q, a }))}
        defaultOpen={target.index}
        className="mt-6 max-w-none"
      />
    </div>
  )
}
