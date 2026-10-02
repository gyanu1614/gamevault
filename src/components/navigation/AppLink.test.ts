import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import AppLink from '@/components/navigation/AppLink'
import { INTENT_ATTR } from '@/lib/navigation/intent-prefetch'

// Record what AppLink hands to next/link: the prefetch prop is the whole contract.
const received: Record<string, unknown>[] = []
vi.mock('next/link', () => ({
  default: (props: Record<string, unknown>) => {
    received.push(props)
    return null
  },
}))

beforeEach(() => {
  received.length = 0
})

describe('AppLink', () => {
  it('turns next/link prefetching off, so a link scrolling into view is never prefetched', () => {
    renderToStaticMarkup(createElement(AppLink, { href: '/valorant' }, 'Valorant'))
    // next/link@14.2 prefetches visible links unless prefetch === false.
    expect(received[0].prefetch).toBe(false)
  })

  it('marks the link for the intent listener, so hover and touch still prefetch it', () => {
    renderToStaticMarkup(createElement(AppLink, { href: '/valorant' }, 'Valorant'))
    expect(received[0][INTENT_ATTR]).toBe('')
  })

  it('prefetch={false} means never: no marker, so not even hover or touch prefetches it', () => {
    renderToStaticMarkup(createElement(AppLink, { href: '/account/earnings', prefetch: false }, 'Earnings'))
    expect(received[0].prefetch).toBe(false)
    expect(INTENT_ATTR in received[0]).toBe(false)
  })

  it('passes everything else through to next/link', () => {
    renderToStaticMarkup(
      createElement(AppLink, { href: '/browse', className: 'x', scroll: false, 'aria-label': 'Browse' }, 'Browse'),
    )
    expect(received[0]).toMatchObject({
      href: '/browse',
      className: 'x',
      scroll: false,
      'aria-label': 'Browse',
      children: 'Browse',
    })
  })

  it('does not accept prefetch={true}: eager viewport prefetching is not available through AppLink', () => {
    // @ts-expect-error prefetch may only be omitted (intent) or false (never)
    renderToStaticMarkup(createElement(AppLink, { href: '/x', prefetch: true }, 'x'))
    // Whatever a caller forces through the type system, the wrapper still sends false.
    expect(received[0].prefetch).toBe(false)
  })
})
