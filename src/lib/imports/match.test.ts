import { describe, it, expect } from 'vitest'
import { buildMatchIndex, matchItem, matchVariant, ACCEPT_SCORE } from './match'
import type { CatalogueItem, CatalogueVariant, ImportCatalogue } from './types'

function item(ref: string, name: string, aliases: string[] = []): CatalogueItem {
  return { ref, name, aliases, facts: {}, imageUrl: null }
}

const CATALOGUE: ImportCatalogue = {
  items: [
    item('shadow-dragon', 'Shadow Dragon', ['shadow drag']),
    item('frost-dragon', 'Frost Dragon'),
    item('shadow-dragon-egg', 'Shadow Dragon Egg'),
    item('bat-dragon', 'Bat Dragon'),
    item('sols-rng-crown', "Sol's RNG Crown"),
  ],
  variants: [
    { ref: 'N', label: 'Normal' },
    { ref: 'NFR', label: 'Neon Fly Ride' },
    { ref: 'MFR', label: 'Mega Fly Ride' },
  ],
}

const index = buildMatchIndex(CATALOGUE, [])

describe('matchItem — exact resolution', () => {
  it('matches the catalogue name', () => {
    const r = matchItem(index, 'Shadow Dragon')
    expect(r.status).toBe('matched')
    expect(r.status === 'matched' && r.item.ref).toBe('shadow-dragon')
    expect(r.status === 'matched' && r.score).toBe(1)
  })

  it('matches regardless of case, punctuation and stray whitespace', () => {
    for (const raw of ['shadow dragon', 'SHADOW  DRAGON', 'Shadow-Dragon!', '  shadow dragon  ']) {
      const r = matchItem(index, raw)
      expect(r.status === 'matched' && r.item.ref, raw).toBe('shadow-dragon')
    }
  })

  it('matches the slug a supplier may paste instead of the name', () => {
    const r = matchItem(index, 'shadow-dragon')
    expect(r.status === 'matched' && r.item.ref).toBe('shadow-dragon')
  })

  it("elides apostrophes so Sols and Sol's are the same item", () => {
    const r = matchItem(index, 'Sols RNG Crown')
    expect(r.status === 'matched' && r.item.ref).toBe('sols-rng-crown')
  })

  it('matches a catalogue alias', () => {
    const r = matchItem(index, 'shadow drag')
    expect(r.status === 'matched' && r.item.ref).toBe('shadow-dragon')
  })

  it('matches an import-only alias taught by a reviewer', () => {
    const withAlias = buildMatchIndex(CATALOGUE, [{ alias: 'shadow d', itemRef: 'shadow-dragon' }])
    const r = matchItem(withAlias, 'Shadow D')
    expect(r.status === 'matched' && r.item.ref).toBe('shadow-dragon')
  })
})

describe('matchItem — supplier noise', () => {
  it('ignores quantity markers a stock list carries', () => {
    for (const raw of ['Shadow Dragon x5', '5x Shadow Dragon', 'Shadow Dragon X10']) {
      const r = matchItem(index, raw)
      expect(r.status === 'matched' && r.item.ref, raw).toBe('shadow-dragon')
    }
  })

  it('ignores commerce words', () => {
    const r = matchItem(index, 'Shadow Dragon cheap instant delivery')
    expect(r.status === 'matched' && r.item.ref).toBe('shadow-dragon')
  })
})

describe('matchItem — never guess', () => {
  it('does NOT treat a longer catalogue name as the shorter one', () => {
    // The game-title scorer rewards "name + tagline"; for items that would
    // silently sell an egg as the pet that hatches from it.
    const r = matchItem(index, 'Shadow Dragon Egg')
    expect(r.status === 'matched' && r.item.ref).toBe('shadow-dragon-egg')
  })

  it('is ambiguous, never matched, when two candidates score alike', () => {
    const twins = buildMatchIndex(
      { items: [item('dragon-a', 'Dragon Alpha'), item('dragon-b', 'Dragon Beta')], variants: [] },
      [],
    )
    const r = matchItem(twins, 'Dragon')
    expect(r.status).not.toBe('matched')
  })

  it('returns unmatched with at most 3 ranked candidates for the reviewer', () => {
    const r = matchItem(index, 'Dragon')
    expect(r.status === 'unmatched' || r.status === 'ambiguous').toBe(true)
    const cands = r.status === 'matched' ? [] : r.candidates
    expect(cands.length).toBeGreaterThan(0)
    expect(cands.length).toBeLessThanOrEqual(3)
    expect(cands[0].score).toBeGreaterThanOrEqual(cands[cands.length - 1].score)
    for (const c of cands) expect(c.score).toBeLessThan(ACCEPT_SCORE)
  })

  it('returns unmatched with no candidates for gibberish', () => {
    const r = matchItem(index, 'zzzz qqqq')
    expect(r.status).toBe('unmatched')
    expect(r.status === 'unmatched' && r.candidates).toEqual([])
  })

  it('returns unmatched for an empty cell instead of throwing', () => {
    for (const raw of ['', '   ', '!!!']) {
      expect(matchItem(index, raw).status, JSON.stringify(raw)).toBe('unmatched')
    }
  })
})

describe('matchVariant', () => {
  it('matches the variant code', () => {
    expect(matchVariant(index, 'NFR')).toEqual({ ref: 'NFR', label: 'Neon Fly Ride' })
  })

  it('matches the variant label, case-insensitively', () => {
    expect(matchVariant(index, 'neon fly ride')).toEqual({ ref: 'NFR', label: 'Neon Fly Ride' })
  })

  it('returns null for an empty cell — "no variant given" is legitimate', () => {
    expect(matchVariant(index, '')).toBeNull()
    expect(matchVariant(index, '   ')).toBeNull()
  })

  it('returns "unknown" for a variant this game does not have, so the row can be rejected', () => {
    expect(matchVariant(index, 'Rideable')).toBe('unknown')
  })

  it('returns null for a game with no variant axis, whatever the cell says', () => {
    const noVariants = buildMatchIndex({ items: CATALOGUE.items, variants: [] }, [])
    expect(matchVariant(noVariants, 'anything')).toBeNull()
  })
})

describe('buildMatchIndex', () => {
  it('flags a catalogue whose names collide, so two items cannot silently share one spelling', () => {
    const dupes = buildMatchIndex(
      { items: [item('a', 'Same Name'), item('b', 'Same  Name!')], variants: [] },
      [],
    )
    const r = matchItem(dupes, 'Same Name')
    expect(r.status).toBe('ambiguous')
    expect(r.status === 'ambiguous' && r.candidates.map((c) => c.ref).sort()).toEqual(['a', 'b'])
  })

  it('lets an import alias override a fuzzy near-miss without touching the catalogue', () => {
    const taught = buildMatchIndex(CATALOGUE, [{ alias: 'dragon', itemRef: 'bat-dragon' }])
    const r = matchItem(taught, 'Dragon')
    expect(r.status === 'matched' && r.item.ref).toBe('bat-dragon')
  })
})
