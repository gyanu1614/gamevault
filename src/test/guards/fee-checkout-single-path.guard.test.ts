/**
 * Fee engine PR 3 — ONE money path, ONE rate source (docs/design/fee-engine.md
 * §3, §8.4, §9 A4/A9).
 *
 * Static pins, no DB:
 *   · checkout no longer reads the TS commission constants — the rate comes
 *     from resolve_seller_fee via lib/fees/resolver. A re-import of
 *     commissionAmount/commissionPct into checkout.ts is the silent-fallback
 *     regression A4 forbids.
 *   · createOrder (the second money path, its own fee logic) is gone from
 *     orders.ts and nothing calls it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

describe('fee engine — checkout is the only order path and reads only the resolver', () => {
  it('checkout.ts does not import commissionAmount / commissionPct / netProceeds from lib/fees', () => {
    const src = read('src/lib/actions/checkout.ts')
    const feesImport = src.match(/import\s*\{([^}]*)\}\s*from\s*'@\/lib\/fees'/)?.[1] ?? ''
    expect(feesImport).not.toMatch(/\bcommissionAmount\b|\bcommissionPct\b|\bnetProceeds\b/)
    expect(src).not.toMatch(/\bcommissionAmount\s*\(|\bcommissionPct\s*\(/)
  })

  it('checkout.ts resolves the rate through lib/fees/resolver', () => {
    const src = read('src/lib/actions/checkout.ts')
    expect(src).toMatch(/from '@\/lib\/fees\/resolver'/)
    expect(src).toMatch(/\bresolveSellerFee\s*\(/)
  })

  it('lib/fees exports no TypeScript commission computation (PR 5 / A9 — the constants are gone)', () => {
    const src = read('src/lib/fees/index.ts')
    for (const sym of ['COMMISSION_PCT', 'ROBLOX_ECONOMY_GAMES', 'PROMO_ZERO_FEE_GAMES', 'FOUNDING_DISCOUNT_PTS', 'commissionPct', 'commissionAmount', 'netProceeds', 'CommissionInput']) {
      expect(src, `${sym} is back in lib/fees`).not.toMatch(new RegExp(`\\b(export\\s+(const|function|interface|type)\\s+)?${sym}\\b\\s*[=(:<]`))
    }
  })

  it('no source file references the retired commission symbols', () => {
    const retired = /\b(COMMISSION_PCT|ROBLOX_ECONOMY_GAMES|PROMO_ZERO_FEE_GAMES|FOUNDING_DISCOUNT_PTS|commissionPct|commissionAmount|netProceeds|handleGuestCheckout|rateLimitCreateOrder)\b/
    const offenders = walk(join(ROOT, 'src'))
      .filter((p) => !p.endsWith('fee-checkout-single-path.guard.test.ts'))
      .filter((p) => retired.test(readFileSync(p, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')))
      .map((p) => p.slice(ROOT.length + 1))
    expect(offenders).toEqual([])
  })

  it('createOrder is deleted from orders.ts', () => {
    expect(read('src/lib/actions/orders.ts')).not.toMatch(/export async function createOrder\b/)
  })

  it('no source file imports createOrder from lib/actions/orders', () => {
    const offenders = walk(join(ROOT, 'src'))
      .filter((p) => /\bcreateOrder\b/.test(readFileSync(p, 'utf8')) && /from\s*'@\/lib\/actions\/orders'/.test(readFileSync(p, 'utf8')))
      .filter((p) => /import\s*\{[^}]*\bcreateOrder\b[^}]*\}\s*from\s*'@\/lib\/actions\/orders'/.test(readFileSync(p, 'utf8')))
    expect(offenders).toEqual([])
  })
})
