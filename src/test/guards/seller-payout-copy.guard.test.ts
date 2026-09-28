/**
 * Seller payout copy never promises an instant withdrawal.
 *
 * A buyer-confirmed sale carries a maturity period (completion_hold_hours)
 * and withdrawals also need the account age and the payout minimum, so
 * "withdraw any time" / "Available to withdraw" right after a sale was
 * false (sellers tried and were refused). Scans the places that talk to a
 * seller at completion.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const FILES = [
  'src/lib/email/index.ts',
  'src/lib/escrow/auto-release.ts',
  'src/app/account/orders/[orderId]/_StatusStrip.tsx',
  'src/lib/actions/orders.ts',
]
const BANNED = [/withdraw any ?time/i, /available to withdraw or use/i, /withdraw it anytime/i]

describe('seller payout copy', () => {
  for (const file of FILES) {
    it(`${file} does not promise an instant withdrawal`, () => {
      const src = readFileSync(file, 'utf8')
      for (const re of BANNED) expect(src, `${file} matches ${re}`).not.toMatch(re)
    })
  }
})
