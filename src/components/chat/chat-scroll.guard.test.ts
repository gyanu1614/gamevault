import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

// Owner, 2026-10-21: on a phone the order chat scrolled "in a weird way" while
// the PAGE was being scrolled. The chat card was sized from 100dvh, which
// changes continuously as the browser's address bar slides away during a page
// scroll; every change resized the message list and use-stick-to-bottom
// (resize: 'smooth') animated it back to the bottom. svh is the stable small
// viewport (bars shown), so the card keeps one height while the page scrolls.
describe('order chat scroll on mobile', () => {
  it('sizes the chat card from the stable small viewport, never the dynamic one', () => {
    const src = read('src/app/account/orders/[orderId]/_OrderChat.tsx')
    expect(src).not.toMatch(/100dvh/)
    expect(src).toMatch(/100svh/)
  })

  it('keeps a scroll inside the thread from chaining into the page (and back)', () => {
    const src = read('src/components/chat/MessageList.tsx')
    const container = src.slice(src.indexOf('ref={scrollRef}'), src.indexOf('ref={scrollRef}') + 240)
    expect(container).toMatch(/overscroll-contain/)
  })
})
