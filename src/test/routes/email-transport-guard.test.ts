/**
 * Regression test for the 2026-09-12 live-email leak.
 *
 * A `vitest run` sent real "You made a sale" / order-receipt emails to real
 * sellers and left orphaned notifications on production accounts.
 * webhook-router.integration.test.ts inserted an order against the PROD
 * Supabase (setup-env.ts loads .env.local into every run) and called the real
 * handleWebhook(), whose dispatch fans out to notify.ts → @/lib/email with a
 * live RESEND_API_KEY. The only kill-switch was an ABSENT key, which
 * .env.local always supplies.
 *
 * Two guards now stand in the way; this asserts both.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import {
  assertEmailTransportAllowed,
  isTestRun,
} from '@/lib/email/transport-guard'
import { assertGuardTargetAllowed } from '@/test/guards/throwaway'

describe('email transport guard', () => {
  it('knows it is inside a test run right now', () => {
    expect(isTestRun()).toBe(true)
  })

  it('throws on a real send from a test run', () => {
    expect(() =>
      assertEmailTransportAllowed({ VITEST: '1' }, 'You made a sale — X'),
    ).toThrow(/refusing to send real email from a test run/)
  })

  it('names the offending subject and the mocking remedy', () => {
    let msg = ''
    try {
      assertEmailTransportAllowed({ VITEST: '1' }, 'You made a sale — X')
    } catch (e) {
      msg = (e as Error).message
    }
    expect(msg).toContain('You made a sale')
    expect(msg).toContain("vi.mock('@/lib/email'")
  })

  it('allows the deliberate opt-out', () => {
    expect(() =>
      assertEmailTransportAllowed({ VITEST: '1', ALLOW_REMOTE_GUARD_TESTS: '1' }),
    ).not.toThrow()
  })

  it('does not interfere outside a test run', () => {
    expect(() => assertEmailTransportAllowed({})).not.toThrow()
    expect(isTestRun({})).toBe(false)
  })

  it('is wired into the single send chokepoint, not per-sender', () => {
    const email = readFileSync('src/lib/email/index.ts', 'utf8')
    expect(email).toMatch(/assertEmailTransportAllowed\(/)
    // Guarding resend.emails.send covers every sender in the module.
    const guardAt = email.indexOf('assertEmailTransportAllowed(')
    const clientAt = email.indexOf('const client = getResendClient()')
    expect(guardAt).toBeGreaterThan(-1)
    expect(guardAt).toBeLessThan(clientAt)
  })
})

describe('webhook integration test refuses a remote DB', () => {
  const source = readFileSync('src/lib/payments/webhook-router.integration.test.ts', 'utf8')

  it('calls assertGuardTargetAllowed before creating anything', () => {
    expect(source).toMatch(/assertGuardTargetAllowed\(URL, process\.env\)/)
    const guardAt = source.indexOf('assertGuardTargetAllowed(URL')
    const insertAt = source.indexOf("from('orders')")
    expect(guardAt).toBeLessThan(insertAt)
  })

  it('cleans up the notifications its dispatch inserts', () => {
    expect(source).toMatch(/from\('notifications'\)\.delete\(\)/)
  })

  it('rejects the production URL and accepts a local one', () => {
    expect(() =>
      assertGuardTargetAllowed('https://cserfvellsliylifjkos.supabase.co', {}),
    ).toThrow(/refuse to run against non-local Supabase URL/)
    expect(() => assertGuardTargetAllowed('http://127.0.0.1:54321', {})).not.toThrow()
    expect(() =>
      assertGuardTargetAllowed('https://cserfvellsliylifjkos.supabase.co', {
        ALLOW_REMOTE_GUARD_TESTS: '1',
      }),
    ).not.toThrow()
  })
})
