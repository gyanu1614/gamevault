import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_SLOW_MS, timed } from './timing'

describe('timed', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stays quiet below the threshold and returns the result', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(timed('quick', async () => 7)).resolves.toBe(7)
    expect(warn).not.toHaveBeenCalled()
  })

  it('logs a slow read with its label and time', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValueOnce(0).mockReturnValueOnce(ADMIN_SLOW_MS + 5)
    await timed('slow', async () => 1)
    expect(warn).toHaveBeenCalledWith(`[admin-slow] slow ${ADMIN_SLOW_MS + 5}ms`)
  })

  it('logs and rethrows when the read fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValueOnce(0).mockReturnValueOnce(ADMIN_SLOW_MS)
    await expect(
      timed('broken', async () => {
        throw new Error('no')
      }),
    ).rejects.toThrow('no')
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
