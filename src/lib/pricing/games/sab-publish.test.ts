import { describe, expect, it, vi } from 'vitest'
import { publishSabMarketEstimates } from './sab-publish'

describe('publishSabMarketEstimates (reprice step; was the edge import publish)', () => {
  it('calls sab_publish_market_estimates and reports the row count', async () => {
    const rpc = vi.fn(async () => ({ data: 412, error: null }))
    await expect(publishSabMarketEstimates({ rpc })).resolves.toEqual({ ok: true, rows: 412 })
    expect(rpc).toHaveBeenCalledWith('sab_publish_market_estimates')
  })

  it('a failure is reported, never thrown: it only feeds fallback prices (48 h), the live estimate still wins', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'canceling statement due to statement timeout' } }))
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(publishSabMarketEstimates({ rpc })).resolves.toEqual({
      ok: false,
      error: 'canceling statement due to statement timeout',
    })
    expect(errorLog).toHaveBeenCalled()
    errorLog.mockRestore()
  })
})
