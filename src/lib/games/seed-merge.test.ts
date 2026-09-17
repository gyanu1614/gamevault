import { describe, it, expect } from 'vitest'
import { mergeGameRow, findAliasSlugCollisions } from './seed-merge'

/**
 * Step 1d · E2 + E3.
 *
 * E2 — the seeder's update path must be FILL-ONLY for the human-authored
 * text columns. During the Step 1 ship it was safe to let it write name and
 * description only because production happened to hold blanks; a second run
 * against hand-edited copy would have overwritten it. Ecosystem, tier and
 * image stay freely updatable — they are config, not prose.
 *
 * E3 — a CSV row whose alias equals another row's slug would make the same
 * game reachable under two identities, which is exactly the duplicate the
 * Step 1 ship had to filter by hand.
 */

const seeded = {
  name: 'Counter-Strike 2',
  slug: 'cs2',
  ecosystem: 'pc',
  content_tier: 'listed',
  source: 'seed-2026-09',
  description: 'Buy and sell Counter-Strike 2 accounts safely on DropMarket.',
}

describe('mergeGameRow — fill-only text columns', () => {
  it('fills name when production holds an empty string', () => {
    const out = mergeGameRow(seeded, { name: '', description: null })
    expect(out.name).toBe('Counter-Strike 2')
  })

  it('fills name when production holds null', () => {
    const out = mergeGameRow(seeded, { name: null, description: null })
    expect(out.name).toBe('Counter-Strike 2')
  })

  it('fills name when the column is absent entirely', () => {
    const out = mergeGameRow(seeded, {})
    expect(out.name).toBe('Counter-Strike 2')
  })

  it('NEVER overwrites a non-empty name', () => {
    const out = mergeGameRow(seeded, { name: 'CS2 (hand-edited)', description: null })
    expect(out.name).toBe('CS2 (hand-edited)')
  })

  it('NEVER overwrites a non-empty description', () => {
    const out = mergeGameRow(seeded, {
      name: null,
      description: 'Hand-written copy that took someone an afternoon.',
    })
    expect(out.description).toBe('Hand-written copy that took someone an afternoon.')
  })

  it('treats whitespace-only production text as empty and fills it', () => {
    const out = mergeGameRow(seeded, { name: '   ', description: '\n\t ' })
    expect(out.name).toBe('Counter-Strike 2')
    expect(out.description).toBe(seeded.description)
  })

  it('still updates ecosystem, content_tier and source over non-empty values', () => {
    const out = mergeGameRow(
      { ...seeded, ecosystem: 'pc', content_tier: 'data' },
      { ecosystem: 'mobile', content_tier: 'listed', source: 'old', name: 'Kept', description: 'Kept' },
    )
    expect(out.ecosystem).toBe('pc')
    expect(out.content_tier).toBe('data')
    expect(out.source).toBe('seed-2026-09')
    // …while the prose is still protected
    expect(out.name).toBe('Kept')
    expect(out.description).toBe('Kept')
  })

  it('does not invent a description when the CSV has none', () => {
    const out = mergeGameRow({ ...seeded, description: null }, { description: null })
    expect(out.description ?? null).toBeNull()
  })

  it('is a no-op when seeded text matches production exactly', () => {
    const out = mergeGameRow(seeded, { name: seeded.name, description: seeded.description })
    expect(out.name).toBe(seeded.name)
    expect(out.description).toBe(seeded.description)
  })
})

describe('findAliasSlugCollisions', () => {
  it('passes a clean set', () => {
    expect(findAliasSlugCollisions([
      { slug: 'cs2', aliases: ['counter-strike-2', 'csgo'] },
      { slug: 'lol', aliases: ['league-of-legends'] },
    ])).toEqual([])
  })

  it("rejects a row whose alias equals another row's slug", () => {
    const hits = findAliasSlugCollisions([
      { slug: 'cs2', aliases: ['counter-strike-2'] },
      { slug: 'counter-strike-2', aliases: [] },
    ])
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ slug: 'cs2', alias: 'counter-strike-2', collidesWith: 'counter-strike-2' })
  })

  it("allows a row whose alias equals its OWN slug", () => {
    expect(findAliasSlugCollisions([{ slug: 'cs2', aliases: ['cs2'] }])).toEqual([])
  })

  it('is case- and whitespace-insensitive', () => {
    const hits = findAliasSlugCollisions([
      { slug: 'cs2', aliases: ['  Counter-Strike-2 '] },
      { slug: 'counter-strike-2', aliases: [] },
    ])
    expect(hits).toHaveLength(1)
  })

  it('reports every collision, not just the first', () => {
    const hits = findAliasSlugCollisions([
      { slug: 'a', aliases: ['b', 'c'] },
      { slug: 'b', aliases: [] },
      { slug: 'c', aliases: [] },
    ])
    expect(hits).toHaveLength(2)
  })

  it('ignores empty alias entries', () => {
    expect(findAliasSlugCollisions([{ slug: 'cs2', aliases: ['', '  '] }])).toEqual([])
  })
})
