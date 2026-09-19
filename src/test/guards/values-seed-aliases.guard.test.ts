/**
 * The seed script duplicates STEAL_AN_EGG_SEED_ALIASES.
 *
 * scripts/seed-steal-an-egg.mjs is owner-run and must work on plain `node`,
 * so it cannot import the .ts normaliser without a loader flag. The alias set
 * is therefore mirrored there — and a mirror silently drifting is exactly how
 * a match rate quietly degrades (aliases moved it from 82.2% to 91.1%).
 *
 * This asserts the two copies stay identical.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { STEAL_AN_EGG_SEED_ALIASES } from '@/lib/values/normalisers/steal-an-egg'

describe('seed alias mirror', () => {
  it('matches the normaliser copy exactly', () => {
    const script = fs.readFileSync(
      path.join(process.cwd(), 'scripts/seed-steal-an-egg.mjs'),
      'utf8',
    )
    const match = script.match(
      /const STEAL_AN_EGG_SEED_ALIASES = \{([\s\S]*?)\n\}/,
    )
    expect(match, 'alias block not found in the seed script').toBeTruthy()

    // Evaluate the literal rather than regex-parsing it, so formatting
    // differences never fail the test but content differences always do.
    // eslint-disable-next-line no-new-func
    const fromScript = new Function(`return {${match![1]}}`)() as Record<string, string[]>

    expect(Object.keys(fromScript).sort()).toEqual(
      Object.keys(STEAL_AN_EGG_SEED_ALIASES).sort(),
    )
    for (const [key, aliases] of Object.entries(STEAL_AN_EGG_SEED_ALIASES)) {
      expect(fromScript[key], `aliases for ${key}`).toEqual(aliases)
    }
  })
})
