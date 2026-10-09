import { describe, it, expect } from 'vitest'
import {
  MIN_CLIENT_POLL_MS,
  POLL_MS,
  foregroundPoll,
  isTabVisible,
  shouldPollSellerApproval,
} from './intervals'

describe('client poll intervals', () => {
  it('no client poll runs faster than once a minute', () => {
    expect(MIN_CLIENT_POLL_MS).toBe(60_000)
    for (const [name, ms] of Object.entries(POLL_MS)) {
      expect(ms, name).toBeGreaterThanOrEqual(MIN_CLIENT_POLL_MS)
    }
  })

  it('pins the badge and grid intervals', () => {
    expect(POLL_MS.unreadMessages).toBe(60_000)
    expect(POLL_MS.navNotifications).toBe(120_000)
    expect(POLL_MS.navActiveOrders).toBe(120_000)
    expect(POLL_MS.adminHeader).toBe(60_000)
    expect(POLL_MS.sellerPresence).toBe(120_000)
    expect(POLL_MS.recentSales).toBe(120_000)
    expect(POLL_MS.sellerApproval).toBe(60_000)
  })

  it('foregroundPoll never polls a hidden tab and refetches on focus', () => {
    expect(foregroundPoll(60_000)).toEqual({
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    })
  })

  it('foregroundPoll refuses an interval under a minute', () => {
    expect(() => foregroundPoll(5_000)).toThrow()
  })
})

describe('isTabVisible', () => {
  it('reads document.visibilityState', () => {
    expect(isTabVisible({ visibilityState: 'visible' })).toBe(true)
    expect(isTabVisible({ visibilityState: 'hidden' })).toBe(false)
  })
  it('treats a missing document (server) as not visible', () => {
    expect(isTabVisible(undefined)).toBe(false)
  })
})

describe('shouldPollSellerApproval', () => {
  it.each(['pending', 'under_review', 'info_requested'] as const)(
    'polls while an application is %s',
    (status) => {
      expect(shouldPollSellerApproval({ isApprovedSeller: false, sellerApplicationStatus: status })).toBe(true)
    },
  )

  it.each([null, undefined, 'rejected'] as const)('does not poll a buyer (status %s)', (status) => {
    expect(shouldPollSellerApproval({ isApprovedSeller: false, sellerApplicationStatus: status })).toBe(false)
  })

  it('does not poll an approved seller', () => {
    expect(shouldPollSellerApproval({ isApprovedSeller: true, sellerApplicationStatus: 'approved' })).toBe(false)
    expect(shouldPollSellerApproval({ isApprovedSeller: true, sellerApplicationStatus: 'pending' })).toBe(false)
  })
})
