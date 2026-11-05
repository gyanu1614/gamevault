/**
 * The filter panel stays on screen. Its offset is relative to the button, and a
 * button changes width when a filter is ticked (owner, 2026-11-04: the Traits
 * panel slid off the phone), so the offset is worked out from the button's
 * current position, and the panel lands in the same place whatever its width.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/hooks/use-coarse-pointer', () => ({ useCoarsePointer: () => false }))

import { panelOffset } from './FilterDropdown'

const PHONE = 390
const PANEL = 260
const EDGE = 12

/** Where the panel's left edge lands for a 'start'-aligned button ending at the page gutter. */
const leftEdge = (buttonWidth: number) => {
  const right = PHONE - 16
  const left = right - buttonWidth
  return left + panelOffset('start', { left, right }, PHONE)
}

describe('panelOffset', () => {
  it('a wide button near the right edge: the panel fits on screen', () => {
    expect(leftEdge(146) + PANEL).toBeLessThanOrEqual(PHONE - EDGE)
  })

  it('the panel stays in one place while the button changes width (the phone bug)', () => {
    const before = leftEdge(146) // "Choose Traits"
    expect(leftEdge(100)).toBe(before) // "Traits" + one badge
    expect(leftEdge(142)).toBe(before) // "Traits" + three badges
  })

  it('a button with room to its right: the panel starts at the button', () => {
    expect(panelOffset('start', { left: 40, right: 140 }, 1440)).toBe(0)
  })

  it('a button hard against the left edge is pulled in', () => {
    expect(panelOffset('start', { left: 4, right: 104 }, PHONE)).toBe(EDGE - 4)
  })

  it("'end' keeps the panel's right edge on screen", () => {
    expect(panelOffset('end', { left: 300, right: 385 }, PHONE)).toBe(385 - (PHONE - EDGE))
    expect(panelOffset('end', { left: 300, right: 360 }, 1440)).toBe(0)
  })

  it('a screen narrower than the panel: it fills the width between the margins', () => {
    const left = 200
    expect(left + panelOffset('start', { left, right: 300 }, 280)).toBe(EDGE)
  })
})
