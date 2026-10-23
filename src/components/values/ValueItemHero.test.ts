import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('React', React)

import { ValueItemHero } from './ValueItemHero'

const h1Of = (html: string) => html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ''

describe('value item hero New tag', () => {
  it('shows New beside the heading, never inside it (the h1 stays the item name)', () => {
    const html = renderToStaticMarkup(createElement(ValueItemHero, { title: 'Emberbow', isNew: true }))
    expect(h1Of(html)).toBe('Emberbow')
    expect(html).toMatch(/>New<\/span>/)
  })

  it('shows nothing extra for an item that is not new', () => {
    const html = renderToStaticMarkup(createElement(ValueItemHero, { title: 'Emberbow' }))
    expect(html).not.toMatch(/>New</)
  })
})
