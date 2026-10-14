import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.stubGlobal('React', React)

import { BlogDocView } from './BlogDocView'
import { BLOG_CARD } from './surface'

const root = process.cwd()
const callout = (tone: string) => ({
  type: 'doc',
  content: [{ type: 'callout', attrs: { tone }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }],
})
const render = (doc: unknown) => renderToStaticMarkup(React.createElement(BlogDocView, { doc: doc as any }))

// Owner, 2026-10-13: the shared background must never show through a card
// ("why is the table transparent", "our grey doesn't look good on this bg").
describe('blog card surface', () => {
  it('is solid: the near-black gradient, never a see-through fill', () => {
    expect(BLOG_CARD).toContain('bg-[linear-gradient(180deg,#212228_0%,#1A1B1F_100%)]')
    expect(BLOG_CARD).not.toMatch(/bg-white\/|\/(?:[1-9]\d?)\b(?!\])|backdrop-blur/)
  })

  // Owner, 2026-10-13: boxes rectangular and compact, the label on the LEFT
  // and the text beside it (no separate title row) — the value pages' callout look.
  it.each(['tip', 'note', 'warning', 'takeaways'])('a %s box: a tinted rectangle, label left, text beside it', (tone) => {
    const html = render(callout(tone))
    const aside = html.match(/<aside class="([^"]*)" style="([^"]*)"/)
    expect(aside, html).not.toBeNull()
    expect(aside![1]).toContain('grid-cols-[auto_minmax(0,1fr)]')
    expect(aside![1]).toContain('rounded-md')
    // Tinted, but on a solid base: the wallpaper never shows through.
    expect(aside![2]).toMatch(/background:linear-gradient\(rgba\([^)]*\),\s*rgba\([^)]*\)\),\s*#1c1d22/i)
    expect(aside![2]).toMatch(/border-color:rgba\(/)
    // The label and the text are the two cells of ONE row.
    expect(html).toMatch(/<aside[^>]*><div[^>]*data-tone-color[^>]*>.*?<\/div><div class="bp-callout-body[^"]*"[^>]*><p>Hello<\/p><\/div><\/aside>/)
    expect(html).toMatch(/<svg[^>]*>/)
  })

  it('cards are rectangular (8px), never the round 16px', () => {
    expect(BLOG_CARD).toContain('rounded-[8px]')
    const css = readFileSync(join(root, 'src/styles/blog-prose.css'), 'utf8')
    expect(css).not.toMatch(/border-radius:\s*16px/)
  })

  it('gives each box type a clearly different colour', () => {
    const hue = (tone: string) => render(callout(tone)).match(/data-tone-color="([^"]+)"/)?.[1]
    const hues = ['tip', 'note', 'warning', 'takeaways'].map(hue)
    expect(hues.every(Boolean)).toBe(true)
    expect(new Set(hues).size).toBe(4)
  })

  it('tables (article + editor) are solid cards too', () => {
    const css = readFileSync(join(root, 'src/styles/blog-prose.css'), 'utf8')
    const rule = css.match(/\.blog-prose \.blog-table,\s*\.blog-prose \.tableWrapper[^{]*{[^}]*}/)?.[0] ?? ''
    expect(rule).toContain('background: linear-gradient(180deg, #212228 0%, #1A1B1F 100%)')
  })

  // Owner: "one row dark, the other light", like the reference table.
  it('tables alternate their rows and split their columns', () => {
    const css = readFileSync(join(root, 'src/styles/blog-prose.css'), 'utf8')
    expect(css).toMatch(/\.blog-prose tr:nth-child\(even\) > td:not\(\.bp-ui \*\)\s*{\s*background:/)
    expect(css).toMatch(/\+ :is\(th, td\)\s*{\s*border-left:/)
  })

  it('the contents box is the same card', () => {
    const toc = readFileSync(join(root, 'src/app/(marketplace)/[gameSlug]/blog/[slug]/_ArticleToc.tsx'), 'utf8')
    expect(toc).toContain('BLOG_CARD')
    expect(toc).not.toContain('bg-[#16171B]/90')
  })
})
