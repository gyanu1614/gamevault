/**
 * Admin pages link to admin routes only.
 *
 * `/account/orders/<id>` (and `/orders/<id>`, which redirects there) 404s
 * for an admin — the order page lets in only the order's buyer and seller.
 * `/admin/users/<id>` never existed. Admin "View Order" links go to
 * `/admin/orders/<id>`.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'src/app/(admin)'
const BANNED = [
  /href=\{?[`'"]\/account\/orders\/\$\{/,
  /href=\{?[`'"]\/orders\/\$\{/,
  /[`'"]\/admin\/users\//,
]

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(name) ? [p] : []
  })
}

describe('admin order links', () => {
  const files = walk(ROOT)
  it('scans the admin tree', () => {
    expect(files.length).toBeGreaterThan(20)
  })
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    if (!BANNED.some((re) => re.test(src))) continue
    it(`${file} links only to admin routes`, () => {
      for (const re of BANNED) expect(src, `${file} matches ${re}`).not.toMatch(re)
    })
  }
})
