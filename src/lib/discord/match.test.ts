import { describe, expect, it } from 'vitest'

import {
  bestMatch,
  diceCoefficient,
  normalizeText,
  rankMatches,
  scoreMatch,
  type Scorable,
} from './match'
import { splitItems } from './commands/wfl'

/** Real catalog names, including the ones that collide with mutation words. */
const CATALOG = [
  'Garama and Madundung',
  'Skibidi Toilet',
  'Tralalero Tralala',
  'Quesadillo Vampiro',
  'Gold Elf',
  'Ice Dragon',
  'Spyder Elephant',
  'Los Spyderinis',
  'Pumpkini Spyderini',
  'La Vacca Saturno Saturnita',
  'Smurf Cat',
  'Karkerkar Kurkur',
].map((name) => ({ name, normalized: normalizeText(name) }))

function match(query: string): string | null {
  return bestMatch<Scorable & { name: string }>(query, CATALOG)?.name ?? null
}

describe('normalizeText', () => {
  it('mirrors sab_normalize_market_text', () => {
    expect(normalizeText('Garama and Madundung')).toBe('garama and madundung')
    expect(normalizeText("  La  Vacca–Saturno's  ")).toBe('la vacca saturno s')
    expect(normalizeText('!!!')).toBe('')
  })
})

describe('diceCoefficient', () => {
  it('scores identical strings 1 and unrelated strings low', () => {
    expect(diceCoefficient('garama', 'garama')).toBe(1)
    expect(diceCoefficient('garama', 'zzzzzz')).toBeLessThan(0.2)
  })

  it('is order-insensitive enough for word-order drift', () => {
    // "Vampire Quesadillo" vs the catalog's "Quesadillo Vampiro" — the exact
    // naming drift the ingest parser sees.
    const score = diceCoefficient(
      normalizeText('vampire quesadillo'),
      normalizeText('quesadillo vampiro'),
    )
    expect(score).toBeGreaterThan(0.6)
  })
})

describe('scoreMatch tiers', () => {
  it('ranks exact above prefix above substring', () => {
    const exact = scoreMatch('gold elf', 'gold elf')
    const prefix = scoreMatch('gold', 'gold elf')
    const substring = scoreMatch('elf', 'gold elf')

    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(substring)
  })

  it('returns 0 for genuinely unrelated names', () => {
    expect(scoreMatch('helicopter', 'gold elf')).toBe(0)
  })

  it('prefers the shorter completion for a prefix query', () => {
    expect(scoreMatch('los', 'los spyderinis')).toBeGreaterThan(
      scoreMatch('los', 'los spyderinis extra long name here'),
    )
  })
})

describe('matching real catalog names', () => {
  it('matches exact names', () => {
    expect(match('Garama and Madundung')).toBe('Garama and Madundung')
    expect(match('Smurf Cat')).toBe('Smurf Cat')
  })

  it('matches partial names, as autocomplete would', () => {
    expect(match('garama')).toBe('Garama and Madundung')
    expect(match('tralalero')).toBe('Tralalero Tralala')
  })

  it('survives typos', () => {
    expect(match('skibdi toilet')).toBe('Skibidi Toilet')
    expect(match('karkerker kurkur')).toBe('Karkerkar Kurkur')
  })

  it('survives word-order drift', () => {
    expect(match('vampire quesadillo')).toBe('Quesadillo Vampiro')
  })

  it('does not confuse similar Spyder names', () => {
    expect(match('spyder elephant')).toBe('Spyder Elephant')
    expect(match('los spyderinis')).toBe('Los Spyderinis')
    expect(match('pumpkini spyderini')).toBe('Pumpkini Spyderini')
  })

  it('rejects nonsense rather than guessing', () => {
    expect(match('qqqqqqqqqq')).toBeNull()
    expect(match('')).toBeNull()
  })

  it('ranks the intended item first among near-neighbours', () => {
    const ranked = rankMatches('spyder', CATALOG, 5)
    expect(ranked.length).toBeGreaterThan(1)
    expect(ranked[0].item.name).toContain('Spyder')
  })
})

describe('mutation-word collisions', () => {
  // "Gold Elf" and "Ice Dragon" are real items whose names contain (or look
  // like) mutation words. Reading the whole fragment as a name must beat
  // stripping the mutation, or /wfl silently prices the wrong item.
  it('scores the full name above the mutation-stripped remainder', () => {
    const full = scoreMatch(normalizeText('gold elf'), normalizeText('Gold Elf'))
    const stripped = scoreMatch(normalizeText('elf'), normalizeText('Gold Elf'))
    expect(full).toBeGreaterThan(stripped)
  })

  it('still lets a genuine mutation suffix win when the base name matches', () => {
    const stripped = scoreMatch(
      normalizeText('tralalero'),
      normalizeText('Tralalero Tralala'),
    )
    const full = scoreMatch(
      normalizeText('tralalero diamond'),
      normalizeText('Tralalero Tralala'),
    )
    expect(stripped).toBeGreaterThan(full)
  })
})

describe('splitItems', () => {
  it('splits on commas, plus signs, newlines and "and"', () => {
    expect(splitItems('garama, skibidi toilet')).toEqual([
      'garama',
      'skibidi toilet',
    ])
    expect(splitItems('garama + skibidi')).toEqual(['garama', 'skibidi'])
    expect(splitItems('garama\nskibidi')).toEqual(['garama', 'skibidi'])
  })

  it('drops empty fragments from sloppy input', () => {
    expect(splitItems('garama,,  , skibidi')).toEqual(['garama', 'skibidi'])
  })

  it('caps the number of items per side', () => {
    const many = Array.from({ length: 40 }, (_, i) => `item${i}`).join(',')
    expect(splitItems(many).length).toBeLessThanOrEqual(12)
  })
})
