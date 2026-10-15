import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('React', React)
vi.mock('next/image', () => ({ default: (p: { alt: string }) => createElement('img', { alt: p.alt }) }))

import { ValueItemHero } from './ValueItemHero'

const html = renderToStaticMarkup(
  createElement(ValueItemHero, {
    art: { src: null, alt: 'Bat Dragon' },
    title: 'Bat Dragon - Fly Ride',
    titleAs: 'h2',
    stats: [
      { label: 'Type', value: 'Pet' },
      { label: 'Availability', value: 'unobtainable' },
      { label: 'Trade Value', value: createElement('b', null, '1,450') },
    ],
    panel: createElement('div', { 'data-panel': '' }),
  }),
)

// Owner, 2026-10-14: the facts as rows with alternating bands, matching the
// card, on desktop too (it was a loose grid of big numbers there).
describe('item hero facts', () => {
  it('are label-left / value-right rows with alternating bands at every width', () => {
    const dl = html.slice(html.indexOf('<dl'), html.indexOf('</dl>'))
    expect(dl).not.toMatch(/lg:grid|lg:block|lg:odd:bg-transparent/)
    expect(dl.match(/odd:bg-/g)?.length).toBe(3)
    expect(dl).toMatch(/justify-between/)
  })

  it('title-cases plain values and leaves rich values alone', () => {
    expect(html).toContain('>Unobtainable<')
    expect(html).toContain('<b>1,450</b>')
  })

  it('renders the buy panel in the price column', () => {
    expect(html).toContain('data-panel=""')
    expect(html.indexOf('data-panel')).toBeGreaterThan(html.indexOf('</dl>'))
  })
})
