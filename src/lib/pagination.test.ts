import { describe, expect, it } from 'vitest'

import { pageCount, pageHref, pageSlice, pageWindow, parsePage } from './pagination'

describe('pageCount', () => {
  it('rounds up and is at least 1', () => {
    expect(pageCount(0, 24)).toBe(1)
    expect(pageCount(24, 24)).toBe(1)
    expect(pageCount(25, 24)).toBe(2)
    expect(pageCount(68, 24)).toBe(3)
  })
})

describe('parsePage', () => {
  it('reads a positive integer and clamps it to the last page', () => {
    expect(parsePage('2', 3)).toBe(2)
    expect(parsePage('9', 3)).toBe(3)
  })
  it('falls back to page 1 for anything else', () => {
    for (const raw of [null, '', 'abc', '0', '-2', '1.5']) expect(parsePage(raw, 3)).toBe(1)
  })
})

describe('pageSlice', () => {
  it('returns only that page (not everything up to it)', () => {
    const items = Array.from({ length: 30 }, (_, i) => i)
    expect(pageSlice(items, 1, 12)).toEqual(items.slice(0, 12))
    expect(pageSlice(items, 3, 12)).toEqual([24, 25, 26, 27, 28, 29])
  })
})

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
  it('keeps first, last and the neighbours, with gaps between', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20])
    expect(pageWindow(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20])
    expect(pageWindow(20, 20)).toEqual([1, 'gap', 16, 17, 18, 19, 20])
  })
  it('never shows a gap that hides a single page', () => {
    expect(pageWindow(4, 9)).toEqual([1, 2, 3, 4, 5, 'gap', 9])
    expect(pageWindow(5, 9)).toEqual([1, 'gap', 4, 5, 6, 'gap', 9])
  })
})

describe('pageHref', () => {
  it('sets ?page=N and drops it on page 1, keeping other params', () => {
    expect(pageHref('/adopt-me/items', 'sort=price&page=3', 2)).toBe('/adopt-me/items?sort=price&page=2')
    expect(pageHref('/adopt-me/items', 'sort=price&page=3', 1)).toBe('/adopt-me/items?sort=price')
    expect(pageHref('/adopt-me/items', '', 1)).toBe('/adopt-me/items')
  })
})
