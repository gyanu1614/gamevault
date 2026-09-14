/**
 * QUAL-003 — a verification build must not mutate `tsconfig.json`.
 *
 * Next's `writeConfigurationDefaults` appends `<distDir>/types/**\/*.ts` to the
 * `include` of the tsconfig the build type-checks against, whenever that exact
 * string is absent. The test is `rawConfig.include.includes(...)` against
 * `include` only — `exclude` is never consulted — so every
 * `NEXT_DIST_DIR=.next-check next build` used to rewrite `tsconfig.json` and
 * dirty the working tree.
 *
 * The fix points verification builds at `tsconfig.build-check.json`, which
 * pre-registers the alternate dist-dir globs so the check short-circuits.
 * `tsconfig.json` keeps only `.next/types` (ROUTE-005).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const readJsonc = (path: string) =>
  JSON.parse(
    readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, ''),
  ) as { extends?: string; include: string[]; exclude: string[] }

const base = readJsonc('tsconfig.json')
const buildCheck = readJsonc('tsconfig.build-check.json')
const nextConfig = readFileSync('next.config.js', 'utf8')

describe('QUAL-003 — verification builds do not rewrite tsconfig.json', () => {
  it('routes NEXT_DIST_DIR builds at the dedicated tsconfig', () => {
    expect(nextConfig).toMatch(/tsconfigPath:\s*process\.env\.NEXT_DIST_DIR/)
    expect(nextConfig).toContain("'tsconfig.build-check.json'")
  })

  it('build-check config extends the real one so they cannot drift', () => {
    expect(buildCheck.extends).toBe('./tsconfig.json')
  })

  it('pre-registers every dist dir the repo builds with', () => {
    // These are exactly the strings writeConfigurationDefaults would append.
    for (const distDir of ['.next', '.next-check', '.next-check2']) {
      expect(buildCheck.include).toContain(`${distDir}/types/**/*.ts`)
    }
  })

  it('leaves tsconfig.json itself on the canonical dist dir only (ROUTE-005)', () => {
    expect(base.include.filter((p) => p.includes('/types/'))).toEqual([
      '.next/types/**/*.ts',
    ])
  })
})
