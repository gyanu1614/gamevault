import { afterEach, describe, expect, it, vi } from 'vitest'
import { forgetPop, hasSitePageBehind, notePop, noteSiteMove, recallScroll, rememberScroll, wasHistoryMove } from './scroll-memory'

describe('rememberScroll', () => {
  it('gives back the last place on a page', () => {
    rememberScroll('/a?q=1', 100)
    rememberScroll('/a?q=1', 240)
    expect(recallScroll('/a?q=1')).toBe(240)
    expect(recallScroll('/a')).toBeNull()
  })
  it('keeps only the latest pages', () => {
    rememberScroll('/first', 1)
    for (let i = 0; i < 30; i++) rememberScroll(`/page-${i}`, i)
    expect(recallScroll('/first')).toBeNull()
    expect(recallScroll('/page-29')).toBe(29)
  })
})

describe('wasHistoryMove', () => {
  const inEvent = (event?: Event) => vi.stubGlobal('window', { event })
  afterEach(() => {
    inEvent()
    wasHistoryMove()
    vi.unstubAllGlobals()
  })

  it('is false for a new page', () => {
    inEvent()
    expect(wasHistoryMove()).toBe(false)
  })

  it('is true when the page is drawn after our listener', () => {
    inEvent()
    notePop(new Event('popstate'))
    expect(wasHistoryMove()).toBe(true)
    expect(wasHistoryMove()).toBe(false)
  })

  it('is true when the page is drawn before our listener, and the late listener leaves nothing behind', () => {
    const pop = new Event('popstate')
    inEvent(pop)
    expect(wasHistoryMove()).toBe(true)
    notePop(pop)
    inEvent()
    expect(wasHistoryMove()).toBe(false)
  })

  it('a click ends a Back that drew nothing', () => {
    inEvent()
    notePop(new Event('popstate'))
    forgetPop()
    expect(wasHistoryMove()).toBe(false)
  })

  it('another event in progress is not a Back', () => {
    inEvent(new Event('click'))
    expect(wasHistoryMove()).toBe(false)
  })
})

describe('hasSitePageBehind', () => {
  it('follows moves forward and back', () => {
    expect(hasSitePageBehind()).toBe(false)
    noteSiteMove(false)
    expect(hasSitePageBehind()).toBe(true)
    noteSiteMove(true)
    expect(hasSitePageBehind()).toBe(false)
    noteSiteMove(true)
    expect(hasSitePageBehind()).toBe(false)
  })
})
