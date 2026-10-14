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

  // Owner, 2026-10-13: the whole page, faint — the hero recipe's vignette over a
  // heavy scrim over the picture; no band, no blur.
  it('stylesheet: fixed under the content, vignette over scrim over the picture', () => {
    const rule = css.match(/^\.blog-backdrop\s*{[^}]*}/m)?.[0] ?? ''
    expect(rule).toMatch(/position:\s*fixed/)
    expect(rule).toMatch(/z-index:\s*-10/)
    expect(rule).toMatch(/background:\s*var\(--hero-vignette\),\s*linear-gradient\([^;]*\),\s*var\(--blog-backdrop\)/)
    expect(rule).not.toMatch(/blur|calc\(50%/)
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
