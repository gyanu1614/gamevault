import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('React', React)
vi.mock('@/components/navigation/AppLink', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import { ArticleGrid, type ArticleCardData } from './_ArticleGrid'

const post = (n: number): ArticleCardData => ({
  slug: `post-${n}`,
  href: `/adopt-me/blog/post-${n}`,
  title: `Adopt Me Guide ${n}`,
  excerpt: 'A long summary that made every card tall.',
  category: 'Guide',
  date: '30 Jul 2026',
  cover: null,
  readMinutes: 6,
})
const html = () => renderToStaticMarkup(createElement(ArticleGrid, { gameName: 'Adopt Me', gameSlug: 'adopt-me', posts: [1, 2, 3, 4, 5].map(post) }))

// Owner, 2026-10-14: phones get a swipeable row, not a tall list; desktop cards
// narrower and shorter — the title, not the summary.
describe('blog home guide cards', () => {
  it('is a swipe row on phones and a 4-up grid on desktop', () => {
    const h = html()
    expect(h).toMatch(/class="[^"]*\bsnap-x\b[^"]*\boverflow-x-auto\b[^"]*\bsm:grid\b[^"]*\blg:grid-cols-4\b/)
    expect(h.match(/\bsnap-start\b/g)?.length).toBe(5)
  })

  it('shows the title, not the summary', () => {
    const h = html()
    expect(h).toContain('Adopt Me Guide 1')
    expect(h).not.toContain('A long summary that made every card tall.')
  })
})
