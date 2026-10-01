import { describe, it, expect, beforeEach } from 'vitest'
import { lockScroll } from './scroll-lock'

// vitest runs in node: give the module a minimal document to write to.
type El = { style: { overflow: string } }
let body: El
let html: El

beforeEach(() => {
  body = { style: { overflow: '' } }
  html = { style: { overflow: '' } }
  ;(globalThis as any).document = { body, documentElement: html }
})

describe('lockScroll', () => {
  it('locks on the first holder and unlocks when the last one releases', () => {
    const a = lockScroll()
    expect(body.style.overflow).toBe('hidden')
    const b = lockScroll()
    a()
    expect(body.style.overflow).toBe('hidden') // b still holds it
    b()
    expect(body.style.overflow).toBe('')
  })

  it('never leaves the page locked when holders release out of order', () => {
    // The old per-component pattern saved "hidden" in the second holder and
    // restored it after the first had already unlocked → stuck page.
    const menu = lockScroll()
    const page = lockScroll()
    menu()
    page()
    expect(body.style.overflow).toBe('')
  })

  it('ignores a second release from the same holder', () => {
    const a = lockScroll()
    const b = lockScroll()
    a()
    a()
    expect(body.style.overflow).toBe('hidden')
    b()
    expect(body.style.overflow).toBe('')
  })

  it('restores whatever inline value was there before the first lock', () => {
    body.style.overflow = 'auto'
    const a = lockScroll()
    a()
    expect(body.style.overflow).toBe('auto')
  })

  it('counts <html> separately from <body>', () => {
    const page = lockScroll('body')
    const search = lockScroll('html')
    expect(html.style.overflow).toBe('hidden')
    search()
    expect(html.style.overflow).toBe('')
    expect(body.style.overflow).toBe('hidden')
    page()
    expect(body.style.overflow).toBe('')
  })
})
