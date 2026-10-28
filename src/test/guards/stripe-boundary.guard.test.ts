/**
 * Stripe lives in ONE place: the card payment provider (2026-10-27).
 *
 * History (2026-10-24, PR #239): the old Stripe Connect library built
 * `new Stripe(process.env.STRIPE_SECRET_KEY!)` at import, so `next build`
 * died at "collect page data" whenever the key was absent — every local-stack
 * build. That library, its /api/stripe/connect/* routes, the Stripe wallet
 * top-up and the server-action wrapper (the AUTH-004 exploit shape) were
 * removed. Stripe came back as a payment provider on the payments spine, so
 * this guard keeps what #239 bought:
 *
 *   · the SDK is imported only under src/lib/payments/providers/stripe/
 *     (plus tests), and STRIPE_* env is read only in its env.ts (tests may set it)
 *   · no module builds a Stripe client at import: `new Stripe(` appears only
 *     inside the lazy stripeClient() in client.ts
 *   · Connect, the top-up and /api/stripe/* routes stay gone (the webhook is
 *     /api/webhooks/stripe on the spine)
 *   · importing the provider registry with no STRIPE_* env works (the build
 *     collects pages with no keys)
 *
 * The legacy `stripe_*` columns on profiles / orders / payouts are untouched
 * (their drop is an open owner decision); DB guards may still name them.
 */
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(process.cwd(), 'src')
const SELF = relative(process.cwd(), __filename)
const PROVIDER_DIR = 'src/lib/payments/providers/stripe/'

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

/** Strip block and line comments so prose about Stripe is not an offender. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
}

const isTest = (rel: string) => /\.test\.(ts|tsx)$/.test(rel)

function offenders(re: RegExp, allowed: (rel: string) => boolean): string[] {
  const out: string[] = []
  for (const file of walk(ROOT)) {
    const rel = relative(process.cwd(), file)
    if (rel === SELF || allowed(rel)) continue
    withoutComments(readFileSync(file, 'utf8'))
      .split('\n')
      .forEach((line, i) => {
        if (re.test(line)) out.push(`${rel}:${i + 1}`)
      })
  }
  return out
}

describe('Stripe boundary', () => {
  it('package.json carries only the server SDK, pinned to an exact version', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies }
    expect(Object.keys(deps).filter((d) => d.startsWith('@stripe/'))).toEqual([])
    expect(deps.stripe).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('the old Connect library, /api/stripe routes and server-action wrapper stay gone', () => {
    for (const p of ['src/lib/stripe', 'src/app/api/stripe', 'src/lib/actions/stripe-connect.ts']) {
      expect(existsSync(p), p).toBe(false)
    }
    expect(offenders(/['"`]\/api\/stripe\//, () => false)).toEqual([])
  })

  it('only the provider (and tests) import the Stripe SDK', () => {
    const sdk = /from\s+['"](stripe|@stripe\/[^'"]+)['"]|(require|import)\(\s*['"](stripe|@stripe\/[^'"]+)['"]\s*\)/
    expect(offenders(sdk, (rel) => rel.startsWith(PROVIDER_DIR) || isTest(rel))).toEqual([])
  })

  it('STRIPE_* env is read only in the provider env.ts (tests may set it)', () => {
    expect(offenders(/process\.env\.(NEXT_PUBLIC_)?STRIPE_/, (rel) => rel === `${PROVIDER_DIR}env.ts` || isTest(rel))).toEqual([])
  })

  it('a Stripe client is built only inside the lazy stripeClient()', () => {
    expect(offenders(/new\s+Stripe\s*\(/, (rel) => rel === `${PROVIDER_DIR}client.ts`)).toEqual([])
    const client = withoutComments(readFileSync(`${PROVIDER_DIR}client.ts`, 'utf8'))
    // The constructor sits inside the exported function body, never at module scope.
    const fnStart = client.indexOf('export function stripeClient(')
    expect(fnStart).toBeGreaterThan(-1)
    expect(client.indexOf('new Stripe(')).toBeGreaterThan(fnStart)
  })

  it('the provider registry loads with no STRIPE_* env (what `next build` does)', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    vi.resetModules()
    const reg = await import('@/lib/payments/registry')
    expect(reg.getProvider('stripe').name).toBe('stripe')
    vi.unstubAllEnvs()
  })

  it('the env example documents the two server keys and no publishable key', () => {
    const env = readFileSync('.env.local.example', 'utf8')
    expect(env).toMatch(/^STRIPE_SECRET_KEY=$/m)
    expect(env).toMatch(/^STRIPE_WEBHOOK_SECRET=$/m)
    expect(env).not.toMatch(/^\s*NEXT_PUBLIC_STRIPE_/m)
  })
})
