import { describe, it, expect } from 'vitest'
import { scrollHideStep, type ScrollHideState } from './useHideOnScroll'

const at = (lastY: number, hidden = false): ScrollHideState => ({ lastY, hidden })

describe('scrollHideStep', () => {
  it('scrolling down past the top hides the bar', () => {
    expect(scrollHideStep(at(100), 200)).toEqual({ lastY: 200, hidden: true })
  })

  it('a small scroll up brings it back, anywhere on the page', () => {
    expect(scrollHideStep(at(2000, true), 1990)).toEqual({ lastY: 1990, hidden: false })
  })

  it('near the top it always shows', () => {
    expect(scrollHideStep(at(70, true), 60)).toEqual({ lastY: 60, hidden: false })
    expect(scrollHideStep(at(0), 70)).toEqual({ lastY: 70, hidden: false })
  })

  it('a tiny move keeps the state, so it never flickers', () => {
    const hidden = at(500, true)
    expect(scrollHideStep(hidden, 497)).toBe(hidden)
    const shown = at(500, false)
    expect(scrollHideStep(shown, 503)).toBe(shown)
  })

  it('tiny moves add up from the last counted position', () => {
    let s = at(500, false)
    s = scrollHideStep(s, 503)
    s = scrollHideStep(s, 506)
    expect(s.hidden).toBe(true)
  })
})
