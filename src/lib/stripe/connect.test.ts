/**
 * AUTH-004 — the Stripe Connect library must not be a server-action module.
 *
 * With `'use server'` at the top of connect.ts, generateLoginLink(accountId) /
 * generateOnboardingLink(accountId) / createConnectAccount(sellerId) /
 * getConnectAccountStatus(sellerId) were directly invokable actions taking an
 * ARBITRARY id. The exploit is "call the action with someone else's account
 * id"; it is closed when Next.js no longer registers these exports as actions,
 * i.e. when the directive is gone and every caller passes session-derived ids.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

const LIB = readFileSync('src/lib/stripe/connect.ts', 'utf8')
const ROUTES = ['dashboard', 'onboard', 'status'].map((r) => [r, readFileSync(`src/app/api/stripe/connect/${r}/route.ts`, 'utf8')] as const)

describe('AUTH-004 — connect.ts is a library, not an action file', () => {
  it('has no "use server" directive (so its exports are not invokable actions)', () => {
    expect(LIB).not.toMatch(/^\s*['"]use server['"]\s*$/m)
  })

  // QUAL-008 removed src/lib/actions/stripe-connect.ts: it was a parallel,
  // unreferenced implementation (the live /api/stripe/connect/* handlers import
  // @/lib/stripe/connect directly). Deleting it removes the action surface this
  // assertion used to constrain, so the invariant is now "it must not come back"
  // — a re-added 'use server' wrapper is exactly the AUTH-004 exploit shape.
  it('the parallel server-action wrapper stays deleted', () => {
    expect(existsSync('src/lib/actions/stripe-connect.ts')).toBe(false)
  })

  it('API routes authenticate and never read an account/seller id from the request', () => {
    for (const [name, src] of ROUTES) {
      expect(src, name).toMatch(/auth\.getUser\(\)/)
      expect(src, name).not.toMatch(/searchParams\.get\(['"](accountId|sellerId|account_id|seller_id)['"]\)/)
      expect(src, name).not.toMatch(/body\.(accountId|sellerId|account_id|seller_id)/)
    }
    expect(ROUTES.find(([n]) => n === 'dashboard')![1]).toMatch(/generateLoginLink\(profile\.stripe_connect_account_id\)/)
    expect(ROUTES.find(([n]) => n === 'onboard')![1]).toMatch(/createConnectAccount\(user\.id\)/)
    expect(ROUTES.find(([n]) => n === 'status')![1]).toMatch(/getConnectAccountStatus\(user\.id\)/)
  })
})
