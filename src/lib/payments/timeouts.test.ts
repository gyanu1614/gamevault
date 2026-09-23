import { describe, it, expect } from 'vitest'
import { withTimeout, PROVIDER_FETCH_TIMEOUT_MS, RETURN_PROBE_TIMEOUT_MS } from './timeouts'

describe('PAY-016 — provider deadlines', () => {
  it('pins the budgets: 8 s for provider calls, 4 s for the return-route probe', () => {
    expect(PROVIDER_FETCH_TIMEOUT_MS).toBe(8_000)
    expect(RETURN_PROBE_TIMEOUT_MS).toBe(4_000)
  })
  it('withTimeout resolves a fast promise and rejects a slow one with TimeoutError', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok')
    const slow = new Promise((r) => setTimeout(() => r('late'), 200))
    await expect(withTimeout(slow, 20, 'probe')).rejects.toMatchObject({ name: 'TimeoutError' })
  })
})
