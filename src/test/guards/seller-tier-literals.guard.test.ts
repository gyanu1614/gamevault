/**
 * TIER-001 (regression) — no gemstone tier literal survives in src/.
 *
 * Migration 20260908100000_metal_rank_tiers re-keyed the seller ladder
 * (quartz→bronze, amethyst→silver, ruby→gold, sapphire→diamond,
 * diamond→legendary) and guards profiles.seller_tier with the CHECK constraint
 * profiles_seller_tier_check. src/lib/seller/tiers.ts was NOT updated with it,
 * so the approve-seller path kept writing 'quartz' and every approval failed in
 * production with:
 *
 *   new row for relation "profiles" violates check constraint
 *   "profiles_seller_tier_check"
 *
 * This is a pure lexical scan — no DB, no network. It fails if a retired
 * gemstone name reappears anywhere in src/, which is the cheap way to catch the
 * next person re-introducing one.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../../', import.meta.url))

/** Retired gemstone rank names. 'diamond' is EXCLUDED — it is a live rank 4. */
const RETIRED = ['quartz', 'amethyst', 'sapphire'] as const

/**
 * Files allowed to name a retired rank, because they document the history.
 * Keep this list tiny and justified — it is the escape hatch, not the norm.
 */
const ALLOWED = new Set([
  'lib/seller/tiers.ts',        // header comment records the re-key mapping
  'lib/seller/entry-tier.ts',   // explains why the entry rank is read live
  'test/guards/seller-tier-literals.guard.test.ts', // this file
  'test/guards/throwaway.ts',   // fixture helper comment
  // Asserts the DB still REJECTS the retired entry rank — it must name it.
  'test/guards/seller-approve-tier.guard.integration.test.ts',
])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

describe('TIER-001 — retired gemstone tier names are gone from src/', () => {
  const files = walk(SRC)

  it('finds source files to scan (guards against a broken walk)', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it.each(RETIRED)('no source file mentions %s', (name) => {
    const re = new RegExp(name, 'i')
    const offenders = files
      .map((f) => ({ rel: relative(SRC, f), body: readFileSync(f, 'utf8') }))
      .filter(({ rel }) => !ALLOWED.has(rel))
      .filter(({ body }) => re.test(body))
      .map(({ rel }) => rel)

    expect(offenders, `retired rank "${name}" still referenced in: ${offenders.join(', ')}`).toEqual([])
  })

  it('the exported ladder is exactly the metal ranks the CHECK constraint allows', async () => {
    const { TIER_KEYS, DEFAULT_TIER } = await import('@/lib/seller/tiers')
    // Mirrors profiles_seller_tier_check from 20260908100000_metal_rank_tiers.
    expect([...TIER_KEYS].sort()).toEqual(['bronze', 'diamond', 'gold', 'legendary', 'silver'])
    expect(DEFAULT_TIER).toBe('bronze')
  })
})
