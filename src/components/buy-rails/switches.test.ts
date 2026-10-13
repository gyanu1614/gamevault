import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { createElement, isValidElement, type ReactElement } from 'react'

// vitest compiles the components' JSX with the classic runtime.
;(globalThis as { React?: typeof React }).React = React

// Every surface off: each wrapper must hand back its children untouched (no
// rails, no bar, no extra reads).
const reads = { gameRails: 0, valueStock: 0, itemRail: 0 }
vi.mock('server-only', () => ({}))
// The client components below reach the cookie client through useAuth's graph; never called here.
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => { throw new Error('no cookie client') } }))
vi.mock('@/lib/buy-rails/server', () => ({
  getRailSettings: async () => ({ blog: false, value_item: false, value_list: false, calculator: false }),
  getGameRails: async () => { reads.gameRails++; return { currency: null, items: null } },
  getValueItemRail: async () => { reads.itemRail++; return null },
}))
vi.mock('@/lib/value-listings/stock-server', () => ({ getValueStock: async () => { reads.valueStock++; return null } }))

describe('admin switches turn surfaces off', () => {
  it('value item pages: the body renders exactly as without rails', async () => {
    const { ValueItemRails } = await import('./ValueItemRails')
    const child = createElement('p', null, 'body')
    const out = (await ValueItemRails({ gameSlug: 'adopt-me', itemSlug: 'bat-dragon', itemName: 'Bat Dragon', imageUrl: null, children: child })) as ReactElement
    expect(isValidElement(out)).toBe(true)
    expect((out.props as { children: unknown }).children).toBe(child)
    expect(reads.gameRails + reads.itemRail).toBe(0)
  })

  it('value lists: no Buy line provider, no phone bar, no stock read', async () => {
    const { ValueListBuy } = await import('./ValueListBuy')
    const child = createElement('p', null, 'list')
    const out = (await ValueListBuy({ gameSlug: 'adopt-me', children: child })) as ReactElement
    expect((out.props as { children: unknown }).children).toBe(child)
    expect(reads.valueStock).toBe(0)
  })
})
