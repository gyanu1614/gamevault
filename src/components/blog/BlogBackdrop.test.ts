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
  it('is one decorative layer that hands the picture to the stylesheet (no <img>)', () => {
    const html = renderToStaticMarkup(createElement(BlogBackdrop))
    expect(html).toMatch(/^<div aria-hidden="true" class="blog-backdrop" style="--blog-backdrop:url\(([^)]+)\)"><\/div>$/)
    expect(html).toContain(BLOG_BACKDROP_IMAGE)
    expect(html).not.toContain('<img')
  })

  it('points at a file that exists in public/', () => {
    expect(existsSync(join(root, 'public', BLOG_BACKDROP_IMAGE))).toBe(true)
  })

  // Owner, 2026-10-13 (Eldorado's one background): nothing behind the text —
  // a faint character in the empty strip beside the page box, wide screens only.
  it('stylesheet: a fixed layer with no picture of its own', () => {
    const rule = css.match(/^\.blog-backdrop\s*{[^}]*}/m)?.[0] ?? ''
    expect(rule).toMatch(/position:\s*fixed/)
    expect(rule).toMatch(/z-index:\s*-10/)
    expect(rule).not.toContain('--blog-backdrop')
  })

  it('stylesheet: the art fills only the space left of the content, from 1600px', () => {
    const art = css.match(/@media \(min-width: 1600px\)\s*{\s*\.blog-backdrop::before\s*{[^}]*}/)?.[0] ?? ''
    expect(art).toContain('var(--blog-backdrop)')
    expect(art).toContain('width: calc((min(100%, var(--blog-page-max)) - var(--blog-col-w)) / 2 - 48px)')
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
