import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('React', React)

import { FormSwitch } from './FormSwitch'

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('FormSwitch (owner, 2026-10-23: say which form the price is for)', () => {
  it('shows both forms, marks only the active one, and names the item for screen readers', () => {
    const html = renderToStaticMarkup(createElement(FormSwitch, { form: 'standard', onChange: () => {}, itemName: "Traveler's Gun" }))
    expect(text(html)).toBe('Standard Chroma')
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(html).toMatch(/role="radio" aria-checked="true"[^>]*>.*Standard/)
    expect(html).toContain('aria-label="Traveler&#x27;s Gun: show the Standard or Chroma version"')
  })

  it('the Chroma half carries the chroma finish only when it is the active form', () => {
    const on = renderToStaticMarkup(createElement(FormSwitch, { form: 'chroma', onChange: () => {}, itemName: 'X' }))
    const off = renderToStaticMarkup(createElement(FormSwitch, { form: 'standard', onChange: () => {}, itemName: 'X' }))
    expect(on).toMatch(/class="[^"]*word[^"]*"/)
    expect(off).not.toMatch(/class="[^"]*word[^"]*"/)
  })
})
