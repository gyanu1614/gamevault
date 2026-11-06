/**
 * The picker on screen: a filled card with its label and the picked value. The
 * open list and the switch itself are in model/offers.test.ts.
 */
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TraitField } from './TraitField'
import { formOptions } from './model/offers'

;(globalThis as { React?: typeof React }).React = React

const forms = [
  { slug: 'travelers-gun', label: 'Common', count: 1, minPriceUsd: 6 },
  { slug: 'chroma-travelers-gun', label: 'Chroma', count: 2, minPriceUsd: 30 },
]
const render = (value: string) => renderToStaticMarkup(React.createElement(TraitField, { noun: 'Type', options: formOptions(forms), value, onChange: () => {} }))

describe('TraitField with Common and Chroma', () => {
  it('shows the label and the version on show', () => {
    expect(render('travelers-gun')).toContain('>Type</span>')
    expect(render('travelers-gun')).toContain('>Common</span>')
    expect(render('chroma-travelers-gun')).toContain('>Chroma</span>')
  })

  it('is one filled card, with a chevron', () => {
    const html = render('travelers-gun')
    expect(html).toContain('bg-white/[0.08]')
    expect(html).toContain('aria-haspopup="listbox"')
    expect(html).toContain('<svg')
  })
})
