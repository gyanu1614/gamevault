/**
 * ROUTE-005 — `tsc --noEmit` must not type-check generated route types from
 * alternate build directories.
 *
 * Next.js emits one `types/app/<route>/page.ts` shim per route and never
 * prunes shims for routes that were deleted. While `tsconfig.json` `include`d
 * `.next-check/types` and `.next-check2/types`, those orphans were compiled
 * and `tsc` failed with TS2307 on a clean checkout (6 errors, from the routes
 * removed by the ROUTE-001 fix) even though nothing in `src/` was wrong.
 *
 * The include list must therefore reference only `.next/types` — the dir Next
 * regenerates for the canonical build — and the alternate dirs must be
 * excluded so a stray artifact can never be swept back in.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const tsconfig = JSON.parse(
  // tsconfig.json is strict JSON in this repo (no comments), so JSON.parse is safe.
  readFileSync('tsconfig.json', 'utf8'),
) as { include: string[]; exclude: string[] }

describe('ROUTE-005 — tsconfig does not compile alternate dist types', () => {
  it('includes only the canonical .next/types generated dir', () => {
    const generated = tsconfig.include.filter((p) => p.includes('/types/'))
    expect(generated).toEqual(['.next/types/**/*.ts'])
  })

  it('does not include any .next-check* types glob', () => {
    expect(tsconfig.include.some((p) => p.startsWith('.next-check'))).toBe(false)
  })

  it('excludes the alternate dist dirs outright', () => {
    expect(tsconfig.exclude).toContain('.next-check')
    expect(tsconfig.exclude).toContain('.next-check2')
  })
})
