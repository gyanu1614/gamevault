import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.stubGlobal('React', React)

import { BlogBackdrop, BLOG_BACKDROP } from './BlogBackdrop'

const root = process.cwd()

describe('BlogBackdrop', () => {
  it('is a fixed, decorative layer under the page content', () => {
    const html = renderToStaticMarkup(createElement(BlogBackdrop))
    const cls = html.match(/^<div aria-hidden="true" class="([^"]*)"/)?.[1].split(' ') ?? []
    expect(cls).toEqual(expect.arrayContaining(['fixed', 'inset-0', '-z-10', 'pointer-events-none']))
    expect(html).toContain('alt=""')
  })

  it('serves a portrait crop to phones and the landscape one to everything else', () => {
    const html = renderToStaticMarkup(createElement(BlogBackdrop))
    expect(html).toContain(`<source media="(orientation: portrait)" srcSet="${BLOG_BACKDROP.portrait}" type="image/avif"/>`)
    expect(html).toContain(`src="${BLOG_BACKDROP.landscape}"`)
  })

  it('points at files that exist in public/', () => {
    for (const src of Object.values(BLOG_BACKDROP)) expect(existsSync(join(root, 'public', src))).toBe(true)
  })

  // Blog home + every article (codes posts render through the article view) share it;
  // value pages keep their per-game art. The page root must be `isolate` so the
  // -z-10 layer paints above the page ground and below everything else.
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
