import { describe, expect, it } from 'vitest'
import { isSellerOnline, ONLINE_WINDOW_MS } from './online'

const NOW = Date.UTC(2026, 8, 27, 12)
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('isSellerOnline', () => {
  it('is online only when flagged AND seen within the window', () => {
    expect(isSellerOnline({ is_online: true, last_seen_at: ago(60_000) }, NOW)).toBe(true)
    expect(isSellerOnline({ is_online: true, last_seen_at: ago(ONLINE_WINDOW_MS + 1) }, NOW)).toBe(false)
    expect(isSellerOnline({ is_online: false, last_seen_at: ago(1_000) }, NOW)).toBe(false)
  })

  it('treats missing presence or timestamps as offline', () => {
    expect(isSellerOnline(null, NOW)).toBe(false)
    expect(isSellerOnline({ is_online: true, last_seen_at: null }, NOW)).toBe(false)
    expect(isSellerOnline({ is_online: true, last_seen_at: 'not a date' }, NOW)).toBe(false)
  })
})
