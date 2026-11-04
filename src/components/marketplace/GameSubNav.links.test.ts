import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi } from 'vitest'

// vitest compiles .tsx with the classic JSX runtime (React.createElement).
;(globalThis as { React?: typeof React }).React = React

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }))
// The Sell button reads who is looking; the static HTML is the signed-out visitor's.
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: null, profile: null, loading: false }) }))
vi.mock('@/hooks/use-seller-prompt', () => ({ useSellerPrompt: () => ({ state: 'visitor', forgetCount: vi.fn() }), forgetSellerListingCount: vi.fn() }))

import GameSubNav from '@/components/marketplace/GameSubNav'
import { hubNavExtras } from '@/app/(marketplace)/[gameSlug]/values/_HubNavExtras'

const categories = [
  { id: 'c1', name: 'Accounts', slug: 'buy-accounts' },
  { id: 'c2', name: 'Items', slug: 'buy-items' },
]

const render = (gameSlug: string, gameName: string, currentCategorySlug = '') =>
  renderToStaticMarkup(
    createElement(GameSubNav, {
      gameSlug,
      gameName,
      currentCategorySlug,
      categories,
      extraTabs: hubNavExtras(gameSlug, gameName),
    }),
  )

// Crawl audit 2026-10-23: the strip is on every game landing, category and
// listing page, and its category tabs were <button>s — no path for a crawler.
describe('GameSubNav links', () => {
  it('renders every category tab as a real link in the server HTML', () => {
    const html = render('fortnite', 'Fortnite')
    expect(html).toContain('href="/fortnite/buy-accounts"')
    expect(html).toContain('href="/fortnite/buy-items"')
    expect(html).not.toMatch(/<button[^>]*>.*?Accounts/)
  })

  it('marks the current category on its link', () => {
    const html = render('fortnite', 'Fortnite', 'buy-items')
    expect(html).toMatch(/<a[^>]*href="\/fortnite\/buy-items"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/fortnite\/buy-items"/)
  })

  // Owner, 2026-10-23: one "Values & Guides" tab after the categories (grey
  // divider) instead of separate Values + Calculator tabs; the footer keeps
  // linking the value list itself.
  it('links a hub game to its values and guides home from one tab', () => {
    const html = render('adopt-me', 'Adopt Me')
    expect(html).toContain('href="/adopt-me/blog"')
    expect(html).toContain('Values &amp; Guides')
    expect(html).not.toContain('href="/adopt-me/calculator"')
  })

  // Owner, 2026-11-02: the ask to sell left the listings header for the
  // sub-navbar (desktop); it is a real link in the server HTML, every game.
  it('carries the Sell button as a link to the seller sign-up', () => {
    for (const [slug, name] of [['adopt-me', 'Adopt Me'], ['fortnite', 'Fortnite']]) {
      const html = render(slug, name)
      expect(html).toMatch(/<a[^>]*href="\/founding#src=subnav"[^>]*>.*?Start Selling/)
    }
  })

  it('adds no tool tabs (and no divider) for a game without a value hub', () => {
    expect(hubNavExtras('fortnite', 'Fortnite')).toBeUndefined()
    expect(render('fortnite', 'Fortnite')).not.toContain('/values"')
  })
})
