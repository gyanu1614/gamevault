import { describe, it, expect } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The test transform emits classic-runtime JSX for the imported component.
;(globalThis as any).React = React
import { ValueSelect } from './ValueSelect'

// Owner bug 2026-10-04: the obtainability select drew its filter icon ABOVE
// "All Obtainability". The shared trigger clamps direct <span> children with
// `[&>span]:line-clamp-1` (display:-webkit-box, vertical), so the icon + value
// wrapper must force flex back on to keep them on one row.
describe('ValueSelect trigger', () => {
  it('keeps icon + value in ONE flex row the trigger clamp cannot stack', () => {
    const html = renderToStaticMarkup(
      createElement(ValueSelect<'all' | 'x'>, {
        value: 'all',
        onChange: () => {},
        options: [
          { value: 'all', label: 'All Obtainability' },
          { value: 'x', label: 'X' },
        ],
        label: 'Filter by obtainability',
        icon: createElement('svg', { 'data-testid': 'icon' }),
      }),
    )
    const row = html.match(/<button[^>]*>\s*<span class="([^"]*)"[^>]*>(.*?)<\/button>/s)
    expect(row, html).not.toBeNull()
    const [, cls, inner] = row!
    expect(cls.split(' ')).toContain('!flex')
    expect(cls.split(' ')).toContain('items-center')
    // Icon and the value text live inside that same row.
    expect(inner).toContain('data-testid="icon"')
  })
})
