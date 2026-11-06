// @vitest-environment node
/**
 * Next runs server actions one at a time. On 2026-11-05 the owner found the wallet
 * and withdrawal pages slow: the site shell queued four reads as server actions on
 * every page, the page queued more behind them, and each one signed the user in again,
 * so the balance arrived after seven or eight round trips.
 *
 * Reads that run as a page loads are plain requests or server page reads. Actions
 * are for writes. A new read in these files fails here until it follows that rule.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = (path: string) => readFileSync(join(process.cwd(), 'src', path), 'utf8')

describe('reads on every page never queue as server actions', () => {
  it.each([
    ['components/navbar-floating.tsx', ['getMyWalletBalance', 'getMyStorePaused']],
    ['hooks/use-seller-presence.ts', ['updatePresenceOnline', 'updatePresenceOffline']],
    ['hooks/use-seller-prompt.ts', ['sellerListingCount']],
  ])('%s', (file, actions) => {
    const code = src(file)
    for (const action of actions) expect(code).not.toContain(action)
  })
})

describe('the wallet and withdrawal pages arrive with their numbers', () => {
  it.each(['app/account/wallet/page.tsx', 'app/account/wallet/withdraw/page.tsx'])('%s is a server page', (file) => {
    const code = src(file)
    expect(code).not.toMatch(/^'use client'/m)
    expect(code).toContain('readWalletOverview')
  })

  it('the withdrawal form loads nothing through an action, and asks for its quote by plain request', () => {
    const code = src('app/account/wallet/withdraw/_WithdrawClient.tsx')
    for (const read of ['getMyWalletOverview', 'getMyPayoutDetails', 'getWithdrawalMethods', 'quoteWithdrawal']) {
      expect(code).not.toContain(read)
    }
    expect(code).toContain('/api/account/withdrawal-quote')
  })

  it('the wallet reads no balance in the browser, and each list waits until the feed needs it', () => {
    const client = src('app/account/wallet/_WalletClient.tsx')
    const feed = src('app/account/wallet/_Activity.tsx')
    for (const read of ['getMyWalletBalance', 'getLoyaltyStats', 'getMyWithdrawalRequests', 'useSellerEarnings']) {
      expect(client).not.toContain(read)
      expect(feed).not.toContain(read)
    }
    expect(feed).toContain("enabled: isSeller && (filter === 'all' || filter === 'sales')")
    expect(feed).toContain("enabled: filter === 'all' || filter === 'purchases'")
  })
})

describe('one wallet address', () => {
  it('has no pages that only redirect', () => {
    expect(existsSync(join(process.cwd(), 'src/app/wallet'))).toBe(false)
    expect(existsSync(join(process.cwd(), 'src/app/account/earnings'))).toBe(false)
  })

  it('still sends the old addresses to the wallet', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.js'), 'utf8')
    expect(config).toContain("source: '/wallet', destination: '/account/wallet'")
    expect(config).toContain("source: '/account/earnings', destination: '/account/wallet'")
  })
})

describe('the payout pause length is read, never written into copy', () => {
  it.each([
    'components/account/settings/PayoutDetailsSection.tsx',
    'app/account/wallet/withdraw/_WithdrawClient.tsx',
    'app/account/wallet/withdraw/_WithdrawHelp.tsx',
  ])('%s', (file) => {
    // Payout times ("24 to 48 hours") are fine; it is the pause that must be read.
    expect(src(file)).not.toMatch(/(pause|reopen)[^.]*\b(24|48) hours\b/i)
  })
})
