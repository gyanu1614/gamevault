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
import { readFileSync } from 'node:fs'

const LIB = readFileSync('src/lib/stripe/connect.ts', 'utf8')
const ACTIONS = readFileSync('src/lib/actions/stripe-connect.ts', 'utf8')
const ROUTES = ['dashboard', 'onboard', 'status'].map((r) => [r, readFileSync(`src/app/api/stripe/connect/${r}/route.ts`, 'utf8')] as const)

describe('AUTH-004 — connect.ts is a library, not an action file', () => {
  it('has no "use server" directive (so its exports are not invokable actions)', () => {
    expect(LIB).not.toMatch(/^\s*['"]use server['"]\s*$/m)
  })

  it('the action entry points take NO parameters — ids come from the session', () => {
    const exported = [...ACTIONS.matchAll(/^export async function (\w+)\s*\(([^)]*)\)/gm)]
    expect(exported.length).toBeGreaterThan(0)
    for (const [, name, params] of exported) {
      expect(params.trim(), `${name} must not accept caller-supplied ids`).toBe('')
    }
    expect(ACTIONS).toMatch(/createConnectAccount\(user\.id\)/)
    expect(ACTIONS).toMatch(/getConnectAccountStatus\(user\.id\)/)
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
