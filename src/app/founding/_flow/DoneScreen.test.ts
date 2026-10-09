// @vitest-environment node
/**
 * The finished-seller card: pins the copy the owner asked for on 2026-10-08.
 * No "verify your identity" nudge (it reads like a reason to leave); instead
 * three reasons to keep going plus the house rules as Do / Don't.
 */
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

;(globalThis as any).React = React
import { DoneScreen } from './DoneScreen'

vi.mock('@/components/navigation/AppLink', () => ({
  default: ({ href, children }: { href: string; children: unknown }) => createElement('a', { href }, children as never),
}))
vi.mock('framer-motion', () => ({ useReducedMotion: () => true }))

describe('DoneScreen', () => {
  const html = renderToStaticMarkup(
    createElement(DoneScreen, { shopName: 'GGTrading', shopSlug: 'ggtrading', logoUrl: null, isFounding: true, isVerified: false, tier: 'bronze' }),
  )

  it('never tells a new seller to go verify', () => {
    expect(html).not.toMatch(/verify/i)
    expect(html).not.toMatch(/\$100/)
  })

  it('shows the house rules as Do and Don’t lists', () => {
    expect(html).toContain('House Rules')
    expect(html).toContain('Be respectful to buyers and other sellers.')
    expect(html).toContain('Trade or take payment outside DropMarket.')
    expect(html).toContain('Share personal or payment details in chat.')
  })

  it('keeps the two doors and the store identity', () => {
    expect(html).toContain('href="/sell/new"')
    expect(html).toContain('href="/shop/ggtrading"')
    expect(html).toContain('GGTrading')
    expect(html).toContain('Founding Seller')
  })
})
