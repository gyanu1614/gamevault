/**
 * The GSC report tests inject every collaborator (fetch, clock, sleep, fs).
 * This backstop makes a forgotten injection fail loudly instead of reaching
 * Google: global `fetch` throws for the duration of the file's tests.
 */
import { afterEach, beforeEach, vi } from 'vitest'

export function blockNetwork(): void {
  beforeEach(() => {
    vi.stubGlobal('fetch', () => {
      throw new Error('GSC tests must not touch the network — inject a fake fetch')
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })
}
