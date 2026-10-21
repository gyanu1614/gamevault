import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { backoffDelayMs } from './backoff'

// 2026-10-20 usage audit (4.3): after paying, the order page router.refresh()ed
// every 4 s (~16 queries per refresh) for as long as the overlay was up,
// ~500 database calls per payment. The realtime UPDATE is the primary signal;
// the poll is a fallback, so it backs off.
describe('backoffDelayMs', () => {
  it('starts at the base and grows by the factor, capped', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => backoffDelayMs(n, { baseMs: 4000, maxMs: 30_000 }))).toEqual([
      4000, 6000, 9000, 13_500, 20_250, 30_000, 30_000,
    ])
  })

  it('makes far fewer refreshes than a fixed 4 s in the first two minutes', () => {
    let t = 0
    let n = 0
    while (true) {
      t += backoffDelayMs(n, { baseMs: 4000, maxMs: 30_000 })
      if (t > 120_000) break
      n += 1
    }
    expect(n).toBeLessThanOrEqual(9)
  })
})

describe('payment polls', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('the post-payment refresh backs off and skips hidden tabs (no fixed 4 s interval)', () => {
    const src = read('src/app/account/orders/[orderId]/_PaymentReturnHandler.tsx')
    expect(src).toMatch(/backoffDelayMs\(/)
    expect(src).toMatch(/isTabVisible\(\)/)
    expect(src).not.toMatch(/setInterval\(\(\) => router\.refresh\(\)/)
  })

  it('the pay page makes no status call while its tab is hidden', () => {
    const src = read('src/app/checkout/pay/[orderId]/_PayClient.tsx')
    const tick = src.slice(src.indexOf('const tick = async () => {'), src.indexOf('const tick = async () => {') + 300)
    expect(tick).toMatch(/if \(!isTabVisible\(\)\)/)
  })
})
