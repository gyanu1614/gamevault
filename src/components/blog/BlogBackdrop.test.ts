import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.stubGlobal('React', React)

import { BlogBackdrop, BLOG_BACKDROP_IMAGE } from './BlogBackdrop'

const root = process.cwd()
const css = readFileSync(join(root, 'src/styles/blog-prose.css'), 'utf8')

describe('BlogBackdrop', () => {
  it('is one decorative layer that hands the picture to the stylesheet (no <img>, so phones never fetch it)', () => {
    const html = renderToStaticMarkup(createElement(BlogBackdrop))
    expect(html).toMatch(/^<div aria-hidden="true" class="blog-backdrop" style="--blog-backdrop:url\(([^)]+)\)"><\/div>$/)
    expect(html).toContain(BLOG_BACKDROP_IMAGE)
    expect(html).not.toContain('<img')
  })

  it('points at a file that exists in public/', () => {
    expect(existsSync(join(root, 'public', BLOG_BACKDROP_IMAGE))).toBe(true)
  })

  it('stylesheet: fixed under the content, picture only from md up', () => {
    const base = css.match(/^\.blog-backdrop\s*{[^}]*}/m)?.[0] ?? ''
    expect(base).toMatch(/position:\s*fixed/)
    expect(base).toMatch(/z-index:\s*-10/)
    expect(base).not.toContain('--blog-backdrop')
    expect(css).toMatch(/@media \(min-width: 768px\)\s*{\s*\.blog-backdrop\s*{[^}]*var\(--blog-backdrop\)/)
  })

  // Blog home + every article (codes posts render through the article view) share it;
  // value pages keep their per-game art. The page root must be `isolate` so the
  // -10 layer paints above the page ground and below everything else.
  it.each([
    'src/app/(marketplace)/[gameSlug]/blog/page.tsx',
    'src/app/(marketplace)/[gameSlug]/blog/[slug]/_article.tsx',
  ])('%s uses the shared backdrop on an isolated root', (file) => {
    const src = readFileSync(join(root, file), 'utf8')
    expect(src).toContain('<BlogBackdrop />')
    expect(src).not.toContain('GameHeroBackdrop')
    expect(src).toMatch(/<main className={`[^`]*\bisolate\b/)
  })
})
