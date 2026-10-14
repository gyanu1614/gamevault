import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('React', React)
vi.mock('@/components/navigation/AppLink', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('../../_SabSellerCta', () => ({ SabSellerCta: () => null }))
vi.mock('@/components/content/ContentDisclaimer', () => ({ ContentDisclaimer: () => null }))

import { ArticleEnd, type RelatedTool } from './_ArticleEnd'
import { BLOG_CARD } from '@/lib/blog/render/surface'

const tools: RelatedTool[] = [
  { kind: 'values', label: 'Adopt Me Value List', desc: 'What every item sells for.', href: '/adopt-me/values' },
  { kind: 'calculator', label: 'Trade Calculator', desc: 'Price both sides.', href: '/adopt-me/calculator' },
]
const render = () =>
  renderToStaticMarkup(createElement(ArticleEnd, { gameSlug: 'adopt-me', gameName: 'Adopt Me', slug: 'x', tools, related: [], includeValueNote: false }))

// Owner, 2026-10-13: each tool card carries its tool's picture (a calculator for
// the calculator), small, tilted at the card's corner, faded and dimmed.
describe('article end: tool cards', () => {
  it('are solid blog cards that fill the reading column', () => {
    const html = render()
    expect(html).not.toContain('max-w-[700px]')
    expect(html.match(new RegExp(BLOG_CARD.replace(/[[\]().*+?^$|\\/]/g, '\\$&'), 'g'))?.length).toBe(2)
  })

  it('each carry a faded, tilted watermark of their own tool', () => {
    const html = render()
    const marks = html.match(/<svg[^>]*data-tool-mark="(\w+)"[^>]*>/g) ?? []
    expect(marks.map((m) => m.match(/data-tool-mark="(\w+)"/)![1])).toEqual(['values', 'calculator'])
    for (const m of marks) {
      expect(m).toContain('aria-hidden="true"')
      expect(m).toMatch(/-rotate-\[\d+deg\]/)
      expect(m).toMatch(/opacity-\[0\.0\d\]/)
    }
  })
})
