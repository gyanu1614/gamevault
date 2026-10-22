import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATALOGUE_GAMES } from '@/lib/catalogue/registry'

const yml = readFileSync('.github/workflows/values-catalogue-daily.yml', 'utf8')

describe('values catalogue workflow (guard)', () => {
  it('runs one matrix job per registered game', () => {
    const keys =
      yml
        .match(/^\s*game: \[([^\]]*)\]/m)?.[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) ?? []
    expect(keys.sort()).toEqual(CATALOGUE_GAMES.map((g) => g.key).sort())
  })
  it('keeps games isolated and alerts when a job fails or times out', () => {
    expect(yml).toMatch(/fail-fast: false/)
    expect(yml).toMatch(/if: \$\{\{ failure\(\) \|\| cancelled\(\) \}\}/)
    expect(yml).toMatch(/DISCORD_OPS_WEBHOOK_URL/)
  })
  it('every game adapter has its own parse test', () => {
    for (const g of CATALOGUE_GAMES) expect(existsSync(`src/lib/catalogue/games/${g.adapter.gameSlug}.test.ts`), g.key).toBe(true)
  })
})
