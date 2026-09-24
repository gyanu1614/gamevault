/**
 * Fixture namespaces (fixture-namespace.ts): each test file mints ids under
 * its own key, so its residue check and purge can never see — or delete —
 * another file's rows.
 */
import { readdirSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { currentTestFile, fileKey, fixtureNamespace } from './fixture-namespace'
import { GUARD_EMAIL_RE } from './throwaway'

function testFiles(dir = 'src'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? testFiles(path.join(dir, e.name)) : e.name.endsWith('.test.ts') ? [path.join(dir, e.name)] : [],
  )
}

describe('fixture namespaces', () => {
  it('every test file in the repo gets a distinct key', () => {
    const files = testFiles()
    const byKey = new Map<string, string>()
    for (const f of files) {
      const k = fileKey(f)
      expect(byKey.get(k), `${f} and ${byKey.get(k)} share key ${k}`).toBeUndefined()
      byKey.set(k, f)
    }
    expect(files.length).toBeGreaterThan(50)
  })

  it('knows which file is running', () => {
    expect(path.basename(currentTestFile())).toBe('fixture-namespace.test.ts')
    expect(fixtureNamespace().key).toBe(fileKey(currentTestFile()))
  })

  it('mints ids the existing global patterns still recognise, inside DB limits', () => {
    const ns = fixtureNamespace('a/b/some.guard.integration.test.ts')
    for (const label of ['seller', 'buyer', 'admin', 'stranger', 'leak']) {
      expect(ns.email(label)).toMatch(GUARD_EMAIL_RE)
      expect(ns.email(label)).toMatch(ns.emailRe)
      expect(ns.username(label).length).toBeLessThanOrEqual(30)
    }
    expect(ns.listingTitle().startsWith(ns.listingLike.replace('%', ''))).toBe(true)
  })

  it("one file's patterns never match another file's ids", () => {
    const a = fixtureNamespace('x/alpha.guard.integration.test.ts')
    const b = fixtureNamespace('x/beta.guard.integration.test.ts')
    expect(a.key).not.toBe(b.key)
    const like = (pattern: string) => new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`)
    expect(b.email('seller')).not.toMatch(a.emailRe)
    expect(b.email('seller')).not.toMatch(like(a.emailLike))
    expect(b.listingTitle()).not.toMatch(like(a.listingLike))
    expect(a.email('seller')).toMatch(like(a.emailLike))
    expect(a.listingTitle()).toMatch(like(a.listingLike))
  })

  it('a second run of the same file shares the key (so it can purge a crashed run) but not the tag', () => {
    const r1 = fixtureNamespace('x/alpha.guard.integration.test.ts')
    let r2 = fixtureNamespace('x/alpha.guard.integration.test.ts')
    for (let i = 0; i < 5 && r2.tag === r1.tag; i++) r2 = fixtureNamespace('x/alpha.guard.integration.test.ts')
    expect(r2.key).toBe(r1.key)
    expect(r2.tag).not.toBe(r1.tag)
  })
})
