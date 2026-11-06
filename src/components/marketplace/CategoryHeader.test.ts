import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

// vitest compiles .tsx with the classic JSX runtime (React.createElement).
;(globalThis as { React?: typeof React }).React = React

import { SingleSelectFilter } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemFilters'
import { CategoryHeader } from './CategoryHeader'

const header = (over: Partial<Parameters<typeof CategoryHeader>[0]> = {}) =>
  renderToStaticMarkup(createElement(CategoryHeader, { gameName: 'Adopt Me', categoryLabel: 'Pets', count: 13, countNoun: { one: 'pet', many: 'pets' }, ...over }))

describe('CategoryHeader', () => {
  it('reads as the search phrase, with the count beside it', () => {
    const html = header()
    expect(html).toContain('>Adopt Me Pets</h1>')
    expect(html).toMatch(/13 pets/)
  })

  it('does not say the game twice when the category already names it', () => {
    expect(header({ categoryLabel: 'Adopt Me Pets' })).toContain('>Adopt Me Pets</h1>')
  })

  it('an Items page reads "<Game> Items", with no number', () => {
    const html = header({ gameName: 'Murder Mystery 2', categoryLabel: 'Items', count: undefined, countNoun: undefined })
    expect(html).toContain('>Murder Mystery 2 Items</h1>')
    expect(html).not.toMatch(/\d+ (items|listings)/)
  })

  it('singular for one, nothing for none', () => {
    expect(header({ count: 1 })).toMatch(/1 pet</)
    expect(header({ count: 0 })).not.toMatch(/0 pets/)
  })
})

// The store page's Game and Category dropdowns share this control: only a real
// sort may read "Sort: …", never "Sort: Fortnite".
describe('SingleSelectFilter label', () => {
  const options = [{ slug: 'fortnite', label: 'Fortnite' }]
  const render = (prefix?: string) => renderToStaticMarkup(createElement(SingleSelectFilter, { title: 'Game', options, value: 'fortnite', onChange: () => {}, prefix }))

  it('shows just the choice by default', () => {
    expect(render()).toContain('Fortnite')
    expect(render()).not.toContain('Sort:')
  })

  it('says what it is when asked', () => {
    expect(render('Sort')).toContain('Sort: ')
  })
})
