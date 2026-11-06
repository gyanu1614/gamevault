/**
 * A force-dynamic route that exports only GET saves every fetch it makes, database
 * calls and outside APIs alike, and reuses the saved answer for a year. Next only
 * turns that off for a route with a POST, or once cookies() or headers() has been
 * called, and a cron checks its secret on request.headers, which doesn't count.
 *
 * On 2026-11-05 chat emails had never sent: every minute the job got the first
 * answer it ever had (nothing due). The Not Delivered sweep and the payment
 * reconciler were frozen the same way. A new route fails here until it sets
 * fetchCache or is listed with a reason.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(process.cwd(), 'src/app/api')

/** These start with the session client, whose cookies() call turns saving off. */
const STARTS_WITH_COOKIES: Record<string, string> = {
  'account/identity-check': 'getIdentityCheckStatus reads the session first',
  'account/listing-count': 'sellerListingCount reads the session first',
  'account/wallet-summary': 'Session client first',
  'account/withdrawal-quote': 'quoteWithdrawal reads the session first',
}

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return routeFiles(path)
    return name === 'route.ts' ? [path] : []
  })
}

const exportsMethod = (source: string, method: string) =>
  new RegExp(`export\\s+(async\\s+function|const)\\s+${method}\\b|export\\s*\\{[^}]*\\b${method}\\b`).test(source)

/** Routes where saving is on unless the file turns it off. */
function savingRoutes() {
  return routeFiles(ROOT)
    .map((file) => ({ name: relative(ROOT, file).replace(/\/route\.ts$/, ''), source: readFileSync(file, 'utf8') }))
    .filter(({ source }) => /export\s+const\s+dynamic\s*=\s*'force-dynamic'/.test(source))
    .filter(({ source }) => exportsMethod(source, 'GET'))
    .filter(({ source }) => !['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].some((m) => exportsMethod(source, m)))
}

describe('job routes never reuse a saved answer', () => {
  it('sets fetchCache on every force-dynamic GET-only route', () => {
    const open = savingRoutes()
      .filter(({ name }) => !(name in STARTS_WITH_COOKIES))
      .filter(({ source }) => !/export\s+const\s+fetchCache\s*=\s*'force-no-store'/.test(source))
      .map(({ name }) => name)
    expect(open).toEqual([])
  })

  it('still sees the jobs that broke', () => {
    const names = savingRoutes().map(({ name }) => name)
    expect(names).toEqual(expect.arrayContaining(['cron/chat-email-digest', 'cron/not-delivered-sweep', 'cron/reconcile-payments']))
  })

  it('lists no route that stopped needing the exception', () => {
    const names = savingRoutes().map(({ name }) => name)
    expect(Object.keys(STARTS_WITH_COOKIES).filter((name) => !names.includes(name))).toEqual([])
  })
})
