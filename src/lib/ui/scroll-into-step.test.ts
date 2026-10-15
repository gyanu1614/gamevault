import { describe, it, expect } from 'vitest'
import { stepScrollTop } from './scroll-into-step'

// Owner, 2026-10-14: after "Sign And Start Selling" (and after every step) the
// page stayed where the button was, so the next step / the welcome screen
// opened off-screen. A step change brings its start into view, under the bar.
describe('stepScrollTop', () => {
  const NAV = 88

  it('scrolls up to the step when its start is above the screen (or under the bar)', () => {
    // Card top 400px above the viewport while scrolled to 1200.
    expect(stepScrollTop({ rectTop: -400, scrollY: 1200, offset: NAV })).toBe(1200 - 400 - NAV)
    expect(stepScrollTop({ rectTop: 40, scrollY: 600, offset: NAV })).toBe(600 + 40 - NAV)
  })

  it('stays put when the step already starts on screen', () => {
    expect(stepScrollTop({ rectTop: 120, scrollY: 300, offset: NAV })).toBeNull()
  })

  it('never scrolls above the top of the page', () => {
    expect(stepScrollTop({ rectTop: -50, scrollY: 20, offset: NAV })).toBe(0)
  })
})
