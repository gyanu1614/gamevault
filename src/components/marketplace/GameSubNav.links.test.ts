import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi } from 'vitest'

// vitest compiles .tsx with the classic JSX runtime (React.createElement).
;(globalThis as { React?: typeof React }).React = React

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }))
vi.mock('@/hooks/useScrollDirection', () => ({ useScrollDirection: () => ({ hidden: false }) }))

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

  it('adds no tool tabs (and no divider) for a game without a value hub', () => {
    expect(hubNavExtras('fortnite', 'Fortnite')).toBeUndefined()
    expect(render('fortnite', 'Fortnite')).not.toContain('/values"')
  })
})
