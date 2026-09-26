/**
 * PAY-019 (round B Part 4): the pay page polled Greenfield every 4 s
 * forever — including in `expired` and `unreachable`, two calls per tick,
 * overlapping when a call was slow — and the countdown kept ticking past
 * zero. The policy is a pure function so the schedule is pinned here.
 */
import { describe, it, expect } from 'vitest'
import { nextPollDelayMs, POLL_BASE_MS, POLL_MAX_MS, countdownShouldContinue } from './poll-policy'

describe('pay page poll policy', () => {
  it('stops on the terminal view', () => {
    expect(nextPollDelayMs('paid', POLL_BASE_MS)).toBeNull()
  })

  it('polls at the base rate while a payment can still land', () => {
    for (const v of ['waiting', 'seen', 'confirming', 'partial'] as const) {
      expect(nextPollDelayMs(v, 60_000)).toBe(POLL_BASE_MS)
    }
  })

  it('backs off ×2 to a 60 s cap in expired / unreachable', () => {
    let d: number | null = POLL_BASE_MS
    const seen: number[] = []
    for (let i = 0; i < 8; i++) {
      d = nextPollDelayMs('unreachable', d!)
      seen.push(d!)
    }
    expect(seen).toEqual([8000, 16000, 32000, 60000, 60000, 60000, 60000, 60000])
    expect(nextPollDelayMs('expired', 60_000)).toBe(POLL_MAX_MS)
    // recovering to a live view snaps back to the base rate
    expect(nextPollDelayMs('waiting', 60_000)).toBe(POLL_BASE_MS)
  })

  it('the countdown stops at zero', () => {
    expect(countdownShouldContinue(1)).toBe(true)
    expect(countdownShouldContinue(0)).toBe(false)
    expect(countdownShouldContinue(-500)).toBe(false)
  })
})
