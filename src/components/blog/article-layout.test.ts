import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BLOG_MAIN_CELL, BLOG_PAGE_BOX, BLOG_PAGE_GRID, BLOG_SIDE_CELL } from './layout'
import { BLOG_PROSE_GRID } from '@/lib/blog/render/BlogDocView'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
const article = read('src/app/(marketplace)/[gameSlug]/blog/[slug]/_article.tsx')
const toc = read('src/app/(marketplace)/[gameSlug]/blog/[slug]/_ArticleToc.tsx')
const home = read('src/app/(marketplace)/[gameSlug]/blog/page.tsx')
const css = read('src/styles/blog-prose.css')

// Owner, 2026-10-13: the text "too narrow" → ONE wide reading column; then
// "centred, with enough space left and right", the contents list + buy card
// "on the right edge of the page".
describe('article layout', () => {
  it('centres the reading column, with the sidebar at the right edge (xl+)', () => {
    expect(BLOG_PAGE_GRID).toContain('xl:grid-cols-[minmax(0,1fr)_minmax(0,var(--blog-col-w))_minmax(300px,1fr)]')
    expect(BLOG_MAIN_CELL).toContain('xl:col-start-2')
    expect(BLOG_SIDE_CELL).toMatch(/xl:col-start-3\b.*xl:justify-self-end/)
    expect(css).toMatch(/--blog-col-w:\s*820px/)
  })

  it('caps the page box so a very wide screen keeps the sidebar near the text', () => {
    expect(BLOG_PAGE_BOX).toBe('max-w-[var(--blog-page-max)]')
    expect(css).toMatch(/--blog-page-max:\s*\d+px/)
  })

  it('wires the cells into the article and the sidebar', () => {
    expect(article).toContain('BLOG_MAIN_CELL')
    expect(toc).toContain('BLOG_SIDE_CELL')
    expect(article).not.toMatch(/RAIL_GRID|<BuyRail/)
  })

  it('lets every block fill the reading column (no 700px measure, no breakout)', () => {
    expect(BLOG_PROSE_GRID).not.toMatch(/700px|960px|col-\[1\/-1\]/)
  })

  // The background art fills the space left of the content: the blog home's content is wider.
  it('tells the background how wide the blog home content is', () => {
    expect(home).toMatch(/<main className={`[^`]*\bblog-home\b/)
    expect(css).toMatch(/\.blog-home\s*{\s*--blog-col-w:\s*\d+px/)
  })
})
