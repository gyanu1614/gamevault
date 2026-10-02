import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  GscHttpError,
  QuotaExhaustedError,
  createThrottle,
  parseRetryAfter,
  withBackoff,
} from '../../../scripts/lib/gsc/throttle'
import { blockNetwork } from './no-network'

blockNetwork()

describe('createThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  it('spaces concurrent callers one slot apart (4 req/s = 250 ms)', async () => {
    const throttle = createThrottle({ minIntervalMs: 250, now: Date.now, sleep })
    const stamps: number[] = []
    const all = [1, 2, 3, 4, 5].map(() => throttle.wait().then(() => stamps.push(Date.now())))
    await vi.advanceTimersByTimeAsync(2000)
    await Promise.all(all)
    expect(stamps).toEqual([0, 250, 500, 750, 1000])
  })

  it('does not bank idle time into a burst', async () => {
    const throttle = createThrottle({ minIntervalMs: 250, now: Date.now, sleep })
    await throttle.wait()
    await vi.advanceTimersByTimeAsync(10_000)
    const stamps: number[] = []
    const all = [1, 2, 3].map(() => throttle.wait().then(() => stamps.push(Date.now())))
    await vi.advanceTimersByTimeAsync(1000)
    await Promise.all(all)
    expect(stamps).toEqual([10_000, 10_250, 10_500])
  })
})

describe('parseRetryAfter', () => {
  it('reads delta-seconds', () => {
    expect(parseRetryAfter('7', 0)).toBe(7000)
  })
  it('reads an HTTP date relative to now', () => {
    const now = Date.parse('2026-10-01T00:00:00Z')
    expect(parseRetryAfter('Thu, 01 Oct 2026 00:00:30 GMT', now)).toBe(30_000)
  })
  it('returns undefined for absent or unparseable values', () => {
    expect(parseRetryAfter(null, 0)).toBeUndefined()
    expect(parseRetryAfter('soon', 0)).toBeUndefined()
  })
})

describe('withBackoff', () => {
  const noJitter = () => 1 // jitter factor 0.5 + 0.5 × 1 → exact exponential delays

  function setup(failures: GscHttpError[], result = 'ok') {
    const slept: number[] = []
    const queue = [...failures]
    const fn = vi.fn(async () => {
      const next = queue.shift()
      if (next) throw next
      return result
    })
    const run = (opts: Partial<Parameters<typeof withBackoff>[1]> = {}) =>
      withBackoff(fn, {
        sleep: async (ms) => void slept.push(ms),
        random: noJitter,
        ...opts,
      })
    return { fn, slept, run }
  }

  it('retries 429 with exponential delays, then succeeds', async () => {
    const { fn, slept, run } = setup([new GscHttpError(429, 'slow down'), new GscHttpError(429, 'slow down')])
    await expect(run()).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
    expect(slept).toEqual([1000, 2000])
  })

  it.each([500, 502, 503, 504, 0])('retries status %i', async (status) => {
    const { fn, run } = setup([new GscHttpError(status, 'boom')])
    await expect(run()).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it.each([400, 401, 403, 404])('does not retry status %i', async (status) => {
    const err = new GscHttpError(status, 'nope')
    const { fn, slept, run } = setup([err])
    await expect(run()).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(slept).toEqual([])
  })

  it('honours Retry-After over the computed delay', async () => {
    const { slept, run } = setup([new GscHttpError(429, 'slow', { retryAfterMs: 7000 })])
    await run()
    expect(slept).toEqual([7000])
  })

  it('caps the computed delay at maxMs', async () => {
    const { slept, run } = setup(
      [new GscHttpError(503, 'x'), new GscHttpError(503, 'x'), new GscHttpError(503, 'x')],
    )
    await run({ baseMs: 1000, maxMs: 2500 })
    expect(slept).toEqual([1000, 2000, 2500])
  })

  it('applies jitter between 50% and 100% of the delay', async () => {
    const { slept, run } = setup([new GscHttpError(503, 'x')])
    await run({ random: () => 0 })
    expect(slept).toEqual([500])
  })

  it('gives up after maxRetries and throws the last error', async () => {
    const errs = [1, 2, 3, 4].map((n) => new GscHttpError(503, `try ${n}`))
    const { fn, slept, run } = setup(errs)
    await expect(run({ maxRetries: 3 })).rejects.toBe(errs[3])
    expect(fn).toHaveBeenCalledTimes(4)
    expect(slept).toHaveLength(3)
  })

  it('treats a per-day 429 as quota exhaustion: no retry, no sleep', async () => {
    const { fn, slept, run } = setup([
      new GscHttpError(429, "Quota exceeded for quota metric 'Queries' per day per site"),
    ])
    await expect(run()).rejects.toBeInstanceOf(QuotaExhaustedError)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(slept).toEqual([])
  })

  it('still retries a per-minute 429', async () => {
    const { fn, run } = setup([new GscHttpError(429, "Quota exceeded for quota metric 'Queries' per minute")])
    await expect(run()).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
