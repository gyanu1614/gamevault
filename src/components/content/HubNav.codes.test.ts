import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('React', React)
vi.mock('next/navigation', () => ({ usePathname: () => '/adopt-me/blog/how-to-sell', useRouter: () => ({ push: () => {} }) }))
vi.mock('next/image', () => ({ default: (p: { alt: string }) => createElement('img', { alt: p.alt }) }))
vi.mock('@/components/navigation/AppLink', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/components/navigation/SearchParamsBridge', () => ({ SearchParamsBridge: () => null }))

import { HubNav } from './HubNav'
import type { HubNavData } from '@/lib/content/hubNav'

const adoptMe = { name: 'Adopt Me', slug: 'adopt-me', imageUrl: null, hasGuides: true, homeHref: '/adopt-me/blog' }
const data = (codes: HubNavData['codes']): HubNavData => ({
  games: [adoptMe],
  current: adoptMe,
  tools: ['values'],
  itemsHref: '/adopt-me/buy-items',
  accountsHref: null,
  sellHref: '/adopt-me/sell',
  codes,
})
const codes = [{ slug: 'adopt-me', name: 'Adopt Me', imageUrl: null, href: '/adopt-me/codes' }]
const render = (d: HubNavData) => renderToStaticMarkup(createElement(HubNav, { data: d }))

// Owner, 2026-10-13: Codes is its own button beside the game switcher, not a tab at the end of the nav.
describe('HubNav Codes button', () => {
  it('sits right after the game switcher, before the page tabs', () => {
    const html = render(data(codes))
    const switcher = html.indexOf('aria-label="Switch game')
    const button = html.indexOf('aria-label="Codes by game"')
    const firstTab = html.indexOf('>Guides<')
    expect(switcher).toBeGreaterThan(-1)
    expect(button).toBeGreaterThan(switcher)
    expect(button).toBeLessThan(firstTab)
  })

  it('is not one of the desktop tabs', () => {
    const html = render(data(codes))
    const tabs = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'))
    expect(tabs).toContain('>Guides<')
    expect(tabs).not.toContain('Codes')
  })

  it('is left out when no game has a codes page', () => {
    expect(render(data([]))).not.toContain('Codes by game')
  })
})
