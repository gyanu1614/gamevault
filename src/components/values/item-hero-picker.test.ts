import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('React', React)
vi.mock('next/image', () => ({ default: (p: { alt: string }) => createElement('img', { alt: p.alt }) }))

import { ValueItemHero } from './ValueItemHero'
import { stripMask } from '@/lib/values/variant-selector'

const hero = () =>
  renderToStaticMarkup(
    createElement(ValueItemHero, {
      art: { src: null, alt: 'Griffin' },
      title: 'Bloodrot Griffin',
      stats: [{ label: 'Mutation', value: 'Bloodrot' }, { label: 'In-Game Cost', value: '$400B' }],
      picker: createElement('span', { 'data-picker': '' }),
    }),
  )

// Owner, 2026-10-14: "image on left, and on the right side of the image the
// mutations on a row" under Mutation / In-Game Cost — not squeezed under the art.
describe('item hero picker', () => {
  it('sits under the stats beside the picture on desktop, under the picture on phones', () => {
    const html = hero()
    const dl = html.indexOf('</dl>')
    const desktop = html.indexOf('<div class="mt-5 hidden lg:block"><span data-picker=""></span></div>')
    const phone = html.indexOf('<div class="w-full lg:hidden"><span data-picker=""></span></div>')
    expect(desktop).toBeGreaterThan(dl)
    expect(phone).toBeGreaterThan(-1)
    expect(phone).toBeLessThan(html.indexOf('Bloodrot Griffin'))
  })
})

// Owner: no fade on the left while the first chip is in view; fade only toward hidden chips.
describe('swipeable chip strip edges', () => {
  it('fades only the sides that have more chips beyond them', () => {
    expect(stripMask(true, true)).toBe('none')
    expect(stripMask(true, false)).toBe('linear-gradient(90deg,#000 calc(100% - 20px),transparent)')
    expect(stripMask(false, true)).toBe('linear-gradient(90deg,transparent,#000 20px)')
    expect(stripMask(false, false)).toBe('linear-gradient(90deg,transparent,#000 20px,#000 calc(100% - 20px),transparent)')
  })
})
