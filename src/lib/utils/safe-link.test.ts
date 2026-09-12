/**
 * AUTH-013 — notification links are rendered as <Link href>; an attacker-
 * controlled absolute URL would navigate the victim off-site (in-app
 * phishing). `safeInternalPath` is the single filter used at BOTH write time
 * (notification insert helpers) and render time (notifications page, navbar).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isInternalPath, safeInternalPath } from './safe-link'

describe('AUTH-013 — isInternalPath / safeInternalPath', () => {
  it.each([
    '/account/orders/abc',
    '/checkout/pay/123?x=1#frag',
    '/',
  ])('accepts same-origin path %s', (p) => {
    expect(isInternalPath(p)).toBe(true)
    expect(safeInternalPath(p)).toBe(p)
  })

  it.each([
    'https://evil.example/login',
    'http://evil.example',
    '//evil.example/x',
    '/\\evil.example',
    'javascript:alert(1)',
    'data:text/html,hi',
    'account/orders',        // relative, not rooted
    ' /account',             // leading whitespace
    '/account\nhttps://x',   // control chars
    '',
  ])('rejects %j', (p) => {
    expect(isInternalPath(p)).toBe(false)
    expect(safeInternalPath(p)).toBe('#')
  })

  it('treats null/undefined as no link', () => {
    expect(safeInternalPath(null)).toBe('#')
    expect(safeInternalPath(undefined)).toBe('#')
  })
})

describe('AUTH-013 — every render and write site goes through the filter', () => {
  it('notifications page + navbar render href via safeInternalPath, never the raw column', () => {
    for (const f of ['src/app/notifications/page.tsx', 'src/components/navbar-floating.tsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).toMatch(/href=\{safeInternalPath\(notification\.link\)\}/)
      expect(src, f).not.toMatch(/href=\{notification\.link/)
    }
  })

  it('the shared insert helpers filter links at write time and use the service role', () => {
    const utils = readFileSync('src/lib/utils/notifications.ts', 'utf8')
    expect(utils).toMatch(/isInternalPath|safeInternalPath/)
    expect(utils).not.toMatch(/from '@\/lib\/supabase\/server'/)
    const notify = readFileSync('src/lib/payments/notify.ts', 'utf8')
    expect(notify).toMatch(/isInternalPath|safeInternalPath/)
    const checkout = readFileSync('src/lib/actions/checkout.ts', 'utf8')
    // the incomplete-order nudge must not insert with the session client
    expect(checkout).not.toMatch(/upsertIncompleteNudge\(supabase,/)
  })
})
