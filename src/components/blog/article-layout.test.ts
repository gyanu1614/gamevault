import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BLOG_PAGE_BOX, BLOG_PAGE_GRID } from './layout'
import { BLOG_PROSE_GRID } from '@/lib/blog/render/BlogDocView'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
const article = read('src/app/(marketplace)/[gameSlug]/blog/[slug]/_article.tsx')
const css = read('src/styles/blog-prose.css')

// Owner, 2026-10-13 (Eldorado's layout): the text "too narrow" — ONE wide
// reading column, and ONE sidebar on the right holding the contents list and
// the buy card; the background art stays outside the page box.
describe('article layout', () => {
  it('is one wide column + a right sidebar inside one centred page box', () => {
    expect(BLOG_PAGE_BOX).toBe('max-w-[var(--blog-page-w)]')
    expect(css).toMatch(/--blog-page-w:\s*\d+px/)
    expect(BLOG_PAGE_GRID).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_\d+px\]/)
    expect(article.indexOf('<article')).toBeLessThan(article.indexOf('variant="column"'))
  })

  it('has no left rail or separate right rail any more', () => {
    expect(article).not.toMatch(/RAIL_GRID|<BuyRail/)
  })

  it('lets every block fill the reading column (no 700px measure, no breakout)', () => {
    expect(BLOG_PROSE_GRID).not.toMatch(/700px|960px|col-\[1\/-1\]/)
  })
})
