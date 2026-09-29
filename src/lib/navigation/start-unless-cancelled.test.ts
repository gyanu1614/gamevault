import { describe, expect, it, vi } from 'vitest'
import { startUnlessCancelled } from './start-unless-cancelled'

describe('startUnlessCancelled (route progress on link clicks)', () => {
  it('starts for a plain link click', () => {
    const start = vi.fn()
    let later: () => void = () => {}
    const event = { defaultPrevented: false }
    startUnlessCancelled(event, start, (fn) => (later = fn))
    later()
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('does not start when a button inside the link cancels it after the capture listener ran', () => {
    const start = vi.fn()
    let later: () => void = () => {}
    const event = { defaultPrevented: false }
    startUnlessCancelled(event, start, (fn) => (later = fn))
    event.defaultPrevented = true // the dismiss X's own onClick: e.preventDefault()
    later()
    expect(start).not.toHaveBeenCalled()
  })
})
