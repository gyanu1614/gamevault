/**
 * Step 4 — the importer must not become a second listing-creation path.
 *
 * The hard rule of the step: one publish path. The importer calls the same
 * `@/lib/listings/create` seam and the same `@/lib/listings/validate` validator
 * as the sell wizard, so validation, the moderation triggers, the fee grid and
 * revalidation all apply identically to an imported listing.
 *
 * This guard finds violations statically rather than trusting review:
 *   1. the ONLY files that may insert into `listings` are the create seam and
 *      the two grandfathered writers
 *   2. the importer's action module must import the seam, the validator and the
 *      revalidation helper
 *   3. `approvedBy` (born-approved, which skips moderation) may only be passed
 *      by an admin path — a seller path passing it would be AUTH-031 again
 *   4. import copy is held to the same banned vocabulary as the hub copy
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      // `src/test` is test infrastructure: its fixtures deliberately insert raw
      // rows to prove the DB guards fire. This rule is about application code.
      if (name === 'node_modules' || name === 'test') continue
      walk(p, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const FILES = walk(SRC).map((f) => ({ path: relative(ROOT, f), source: readFileSync(f, 'utf8') }))
const rel = (p: string) => p.split('\\').join('/')

describe('one listing-creation path', () => {
  /** The seam itself, plus writers that predate it with a stated reason. */
  const ALLOWED_INSERTERS: Record<string, string> = {
    'src/lib/listings/create.ts': 'the seam itself',
    'src/lib/actions/test-data.ts': 'dev tooling; test-seller listings are never rendered',
  }

  it('nothing else inserts into listings', () => {
    const offenders = FILES.filter(({ path, source }) => {
      if (rel(path) in ALLOWED_INSERTERS) return false
      // `.from('listings')` … `.insert(` within the same statement.
      return /\.from\(\s*['"]listings['"]\s*\)[\s\S]{0,200}?\.insert\s*\(/.test(source)
    }).map((f) => rel(f.path))

    expect(
      offenders,
      `these files insert listings directly — go through insertListing() in @/lib/listings/create instead:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('the importer goes through the seam, the validator and the revalidation helper', () => {
    const action = FILES.find((f) => rel(f.path) === 'src/lib/actions/admin-imports.ts')
    expect(action, 'src/lib/actions/admin-imports.ts is missing').toBeDefined()
    for (const dep of [
      '@/lib/listings/create',
      '@/lib/listings/validate',
      '@/lib/revalidation/listings',
      '@/lib/categories',
    ]) {
      expect(action!.source, `admin-imports must import ${dep}`).toContain(dep)
    }
  })

  it('the importer never writes the catalogue tables it reads', () => {
    const action = FILES.find((f) => rel(f.path) === 'src/lib/actions/admin-imports.ts')!
    for (const table of ['adopt_me_pets', 'sab_brainrots', 'values_items', 'game_categories', 'global_categories']) {
      const writes = new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)[\\s\\S]{0,200}?\\.(insert|update|upsert|delete)\\s*\\(`)
      expect(writes.test(action.source), `admin-imports must not write ${table}`).toBe(false)
    }
  })
})

describe('born-approved is an admin-only capability', () => {
  /** Files allowed to set approvedBy on a create. */
  const ALLOWED_APPROVERS = new Set(['src/lib/actions/admin-imports.ts'])

  it('only an admin path passes approvedBy', () => {
    const offenders = FILES.filter(({ path, source }) => {
      if (ALLOWED_APPROVERS.has(rel(path))) return false
      if (rel(path) === 'src/lib/listings/create.ts') return false
      return /\bapprovedBy\s*:/.test(source)
    }).map((f) => rel(f.path))

    expect(
      offenders,
      `approvedBy skips moderation (check_listing_moderation returns early) — only an admin action may pass it:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('the admin path that uses it calls requireAdmin', () => {
    const action = FILES.find((f) => rel(f.path) === 'src/lib/actions/admin-imports.ts')!
    expect(action.source).toContain('requireAdmin')
    // every exported action, not just one of them
    const exported = [...action.source.matchAll(/export async function (\w+)/g)].map((m) => m[1])
    expect(exported.length).toBeGreaterThan(4)
    const requireAdminCount = (action.source.match(/requireAdmin\(\)/g) ?? []).length
    expect(
      requireAdminCount,
      `${exported.length} exported actions but only ${requireAdminCount} requireAdmin() calls`,
    ).toBeGreaterThanOrEqual(exported.length - 1) // the lifecycle helpers share one
  })
})

describe('the seller CSV path keeps its bulk tag', () => {
  it("bulkPublishListings still writes metadata.source = 'bulk'", () => {
    // get_seller_publish_policy counts bulk_today_count off this tag; dropping it
    // would silently remove the seller-facing daily cap.
    const wizard = FILES.find((f) => rel(f.path) === 'src/lib/actions/sell-wizard.ts')!
    expect(wizard.source).toContain("source: 'bulk'")
  })

  it("the importer tags its own rows separately, so it is not counted against that cap", () => {
    const action = FILES.find((f) => rel(f.path) === 'src/lib/actions/admin-imports.ts')!
    expect(action.source).toContain("source: 'import'")
  })
})

describe('import copy is held to the hub copy rules', () => {
  const BANNED = [
    /\bescrow\b/i,
    /we hold (your )?funds/i,
    /funds are held/i,
    /holding funds/i,
    /\bpaid on delivery\b/i,
    /paid only after/i,
    /paid out only after/i,
  ]

  it('no string in src/lib/imports uses payout-timing or custody language', () => {
    const importFiles = FILES.filter((f) => rel(f.path).startsWith('src/lib/imports/'))
    expect(importFiles.length).toBeGreaterThan(5)
    const offenders: string[] = []
    for (const { path, source } of importFiles) {
      // Strip line comments so a comment explaining the rule is not a violation.
      const code = source.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')
      for (const re of BANNED) if (re.test(code)) offenders.push(`${rel(path)} → ${re}`)
    }
    expect(offenders).toEqual([])
  })

  it('the trust line is the shared copy slot, not a new claim', () => {
    const copy = FILES.find((f) => rel(f.path) === 'src/lib/imports/copy.ts')!
    expect(copy.source).toContain("from '@/lib/content/theme'")
    expect(copy.source).toContain('HUB_COPY.safedrop')
  })
})
