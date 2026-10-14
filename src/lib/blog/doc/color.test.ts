import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('React', React)

import { TEXT_COLORS, safeColor, stripPastedColors } from './color'
import { blogExtensions } from './schema'
import { BlogDocView } from '@/lib/blog/render/BlogDocView'

const colored = (color: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: '30 tasks', marks: [{ type: 'textStyle', attrs: { color } }] }] }],
})
const render = (doc: unknown) => renderToStaticMarkup(React.createElement(BlogDocView, { doc: doc as any }))

// Owner, 2026-10-13: "a colour picker … so I can highlight text and colour it".
describe('text colour', () => {
  it('accepts only a plain hex colour (what the picker makes)', () => {
    expect(safeColor('#FACC15')).toBe('#facc15')
    expect(safeColor('#abc')).toBe('#abc')
    for (const bad of ['red', 'rgb(0, 0, 0)', '#12345', '', 'javascript:alert(1)', '#facc15;background:url(x)', null, 42]) {
      expect(safeColor(bad)).toBeNull()
    }
  })

  it('offers a palette of distinct, safe colours', () => {
    expect(TEXT_COLORS.length).toBeGreaterThanOrEqual(10)
    expect(TEXT_COLORS.every((c) => safeColor(c.hex) === c.hex)).toBe(true)
    expect(new Set(TEXT_COLORS.map((c) => c.hex)).size).toBe(TEXT_COLORS.length)
  })

  it('is part of the shared block set, so the editor and the server agree', () => {
    const names = blogExtensions().map((e) => e.name)
    expect(names).toEqual(expect.arrayContaining(['textStyle', 'color']))
  })

  it('renders a picked colour on the page', () => {
    expect(render(colored('#facc15'))).toContain('<span style="color:#facc15">30 tasks</span>')
  })

  it('drops anything that is not a hex colour (text stays, colour goes)', () => {
    const html = render(colored('rgb(0, 0, 0)'))
    expect(html).toContain('30 tasks')
    expect(html).not.toContain('style="color')
  })

  // Copying from a web page brings its text colours (often black, unreadable here).
  it('strips colours from pasted HTML, keeping the rest of the style', () => {
    expect(stripPastedColors('<span style="color: rgb(0, 0, 0); font-weight: 700">a</span>')).toBe('<span style="font-weight: 700">a</span>')
    expect(stripPastedColors('<span style="background-color:#fff;color:#000">a</span>')).toBe('<span style="background-color:#fff;">a</span>')
    expect(stripPastedColors('<p>plain</p>')).toBe('<p>plain</p>')
  })
})
