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
 *   2. the importer's apply module (the only one that writes listings) must
 *      import the seam, the validator and the revalidation helper
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

/** The importer's server actions: reads/preview/teach, and apply/lifecycle. */
const READ_ACTIONS = 'src/lib/actions/admin-imports.ts'
const APPLY_ACTIONS = 'src/lib/actions/admin-import-apply.ts'
const IMPORTER_MODULES = [READ_ACTIONS, APPLY_ACTIONS, 'src/lib/imports/admin/data.ts']
const file = (p: string) => {
  const f = FILES.find((x) => rel(x.path) === p)
  expect(f, `${p} is missing`).toBeDefined()
  return f!
}

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
    const action = file(APPLY_ACTIONS)
    for (const dep of [
      '@/lib/listings/create',
      '@/lib/listings/validate',
      '@/lib/revalidation/listings',
      '@/lib/categories',
    ]) {
      expect(action.source, `${APPLY_ACTIONS} must import ${dep}`).toContain(dep)
    }
  })

  it('the importer never writes the catalogue tables it reads', () => {
    for (const path of IMPORTER_MODULES) {
      const { source } = file(path)
      for (const table of ['adopt_me_pets', 'sab_brainrots', 'values_items', 'game_categories', 'global_categories']) {
        const writes = new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)[\\s\\S]{0,200}?\\.(insert|update|upsert|delete)\\s*\\(`)
        expect(writes.test(source), `${path} must not write ${table}`).toBe(false)
      }
    }
  })
})

describe('born-approved is an admin-only capability', () => {
  /** Files allowed to set approvedBy on a create. */
  const ALLOWED_APPROVERS = new Set([APPLY_ACTIONS])

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

  /** Each top-level function's body, up to the next top-level function. */
  function functionBodies(source: string): Array<{ name: string; exported: boolean; body: string }> {
    const starts = [...source.matchAll(/^(export )?async function (\w+)\(/gm)]
    return starts.map((m, i) => ({
      name: m[2],
      exported: !!m[1],
      body: source.slice(m.index!, i + 1 < starts.length ? starts[i + 1].index : undefined),
    }))
  }

  it('every importer action checks the caller is an admin', () => {
    for (const path of [READ_ACTIONS, APPLY_ACTIONS]) {
      const fns = functionBodies(file(path).source)
      // A local helper that runs requireAdmin() itself (setBatchListingStatus).
      const guarded = new Set(fns.filter((f) => !f.exported && f.body.includes('requireAdmin()')).map((f) => f.name))
      const exported = fns.filter((f) => f.exported)
      expect(exported.length, `${path} exports no actions`).toBeGreaterThan(0)
      for (const fn of exported) {
        const ok = fn.body.includes('requireAdmin()') || [...guarded].some((g) => fn.body.includes(`${g}(`))
        expect(ok, `${path} → ${fn.name} must call requireAdmin() before touching the service-role client`).toBe(true)
      }
    }
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
    expect(file(APPLY_ACTIONS).source).toContain("source: 'import'")
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
