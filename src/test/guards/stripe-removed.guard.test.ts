/**
 * Stripe is gone and stays gone (2026-10-24).
 *
 * DropMarket never took a live Stripe payment: payments are Payssion (local
 * methods), self-hosted BTCPay (crypto) and the internal wallet ledger. The
 * leftover Stripe Connect library built `new Stripe(process.env.STRIPE_SECRET_KEY!)`
 * at import, so `next build` died at "collect page data" for
 * /api/stripe/connect/dashboard whenever the key was absent — which is every
 * local-stack build (builds may not use the live .env.local since the
 * 2026-10-20 outage). The library, its three API routes, the Stripe wallet
 * top-up and the `stripe` package were removed instead of feeding a dummy key.
 *
 * This guard replaces src/lib/stripe/connect.test.ts (AUTH-004). That test
 * pinned the Connect library as a non-action module whose routes take only
 * session-derived ids; with the library deleted, its invariant becomes "no
 * Stripe surface exists at all", which also keeps the deleted
 * src/lib/actions/stripe-connect.ts wrapper (the AUTH-004 exploit shape) out.
 *
 * The legacy `stripe_*` columns on profiles / orders / payouts still exist
 * until their drop migration lands; DB guards and the column privacy lists
 * still name them, and that is fine — this guard only bans the SDK, its env
 * and its routes. A payment provider is added under src/lib/payments/providers.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(process.cwd(), 'src')
const SELF = relative(process.cwd(), __filename)

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules') continue
      walk(p, out)
    } else if (/\.(ts|tsx|mts|cts|js|mjs)$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

/** Strip block and line comments so prose about the removal is not an offender. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
}

const STRIPE_CODE = [
  /from\s+['"](stripe|@stripe\/[^'"]+)['"]/,
  /(require|import)\(\s*['"](stripe|@stripe\/[^'"]+)['"]\s*\)/,
  /process\.env\.(NEXT_PUBLIC_)?STRIPE_/,
  /['"`]\/api\/stripe\//,
]

describe('Stripe is removed', () => {
  it('package.json has no Stripe dependency', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies }
    expect(Object.keys(deps).filter((d) => d === 'stripe' || d.startsWith('@stripe/'))).toEqual([])
  })

  it('the Stripe library, API routes and server-action wrapper do not exist', () => {
    for (const p of ['src/lib/stripe', 'src/app/api/stripe', 'src/lib/actions/stripe-connect.ts']) {
      expect(existsSync(p), p).toBe(false)
    }
  })

  it('no source file imports the Stripe SDK, reads a STRIPE_ env var or calls /api/stripe', () => {
    const offenders: string[] = []
    for (const file of walk(ROOT)) {
      const rel = relative(process.cwd(), file)
      if (rel === SELF) continue
      const lines = withoutComments(readFileSync(file, 'utf8')).split('\n')
      lines.forEach((line, i) => {
        if (STRIPE_CODE.some((re) => re.test(line))) offenders.push(`${rel}:${i + 1}`)
      })
    }
    expect(offenders).toEqual([])
  })

  it('the env example lists no Stripe keys', () => {
    expect(readFileSync('.env.local.example', 'utf8')).not.toMatch(/^\s*(NEXT_PUBLIC_)?STRIPE_/m)
  })
})
