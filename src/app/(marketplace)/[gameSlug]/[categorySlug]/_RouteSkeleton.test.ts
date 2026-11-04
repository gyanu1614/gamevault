import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// vitest compiles .tsx with the classic JSX runtime (React.createElement).
;(globalThis as { React?: typeof React }).React = React

let path = '/'
vi.mock('next/navigation', () => ({ usePathname: () => path }))

import RouteSkeleton from './_RouteSkeleton'

const render = (p: string) => {
  path = p
  return renderToStaticMarkup(createElement(RouteSkeleton))
}

// The skeleton must match the page it stands in for, or the layout jumps on arrival.
describe('RouteSkeleton', () => {
  it("a values game's Items page: picture-top cards, 2 to 4 a row", () => {
    expect(render('/adopt-me/buy-items')).toContain('grid-cols-2 md:grid-cols-3 xl:grid-cols-4')
  })

  it('other games and other categories keep the landscape listing cards', () => {
    expect(render('/fortnite/buy-items')).toContain('grid-cols-1 sm:grid-cols-2 xl:grid-cols-3')
    expect(render('/adopt-me/buy-accounts')).toContain('grid-cols-1 sm:grid-cols-2 xl:grid-cols-3')
  })
})
