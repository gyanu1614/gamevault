import { describe, it, expect } from 'vitest'
import {
  AUTOMATED_SOURCES,
  normalizeTitle,
  scoreCandidate,
  decideMatch,
  decideFill,
  iconObjectPath,
  ACCEPT_THRESHOLD,
  REFRESH_AFTER_DAYS,
  type IconCandidate,
} from './icons'

const cand = (title: string, id: string | number = 1): IconCandidate => ({ title, id })

describe('normalizeTitle', () => {
  it('casefolds and strips punctuation', () => {
    expect(normalizeTitle('Steal A Brainrot!')).toBe('steal a brainrot')
  })

  it('strips the decoration Roblox creators put in titles', () => {
    expect(normalizeTitle('🔥 Steal a Brainrot [UPDATE!] 🔥')).toBe('steal a brainrot')
    expect(normalizeTitle('Blox Fruits (Beta)')).toBe('blox fruits')
  })

  it('collapses whitespace and handles non-latin text', () => {
    expect(normalizeTitle('  Grow   a  Garden  ')).toBe('grow a garden')
    expect(normalizeTitle('原神')).toBe('原神')
  })

  it('returns empty for a title that is pure decoration', () => {
    expect(normalizeTitle('🔥🔥🔥')).toBe('')
  })

  it('elides apostrophes instead of splitting the word', () => {
    // "Sol's RNG" and "Sols RNG" are the same game; splitting produced
    // "sol s rng" vs "sols rng" and a 0.28 score.
    expect(normalizeTitle("Sol's RNG")).toBe('sols rng')
    expect(normalizeTitle('Sols RNG')).toBe('sols rng')
    expect(normalizeTitle("Dandy's World")).toBe('dandys world')
    expect(normalizeTitle('\u2019Tis')).toBe('tis') // curly apostrophe
  })
})

describe('scoreCandidate', () => {
  it('scores an exact normalised match at 1', () => {
    expect(scoreCandidate('Steal a Brainrot', '🔥Steal A Brainrot!')).toBe(1)
  })

  it('scores a noise-token-only difference at 0.9', () => {
    expect(scoreCandidate('Adopt Me', 'Adopt Me! (Roblox)')).toBeGreaterThanOrEqual(0.9)
  })

  it('scores a different game well below the accept bar', () => {
    expect(scoreCandidate('Blox Fruits', 'Pet Simulator 99')).toBeLessThan(ACCEPT_THRESHOLD)
  })

  it('does not accept a mere prefix as the same game', () => {
    // "Steal a Brainrot" vs a knock-off must not auto-fill.
    expect(scoreCandidate('Steal a Brainrot', 'Steal a Brainrot 2 Tycoon RNG')).toBeLessThan(
      ACCEPT_THRESHOLD,
    )
  })

  it('returns 0 when either title is empty after normalising', () => {
    expect(scoreCandidate('🔥', 'Blox Fruits')).toBe(0)
  })

  it('matches a possessive spelled either way', () => {
    expect(scoreCandidate('Sols RNG', "Sol's RNG [ Summer Event ]")).toBeGreaterThanOrEqual(
      ACCEPT_THRESHOLD,
    )
    expect(scoreCandidate("Dandy's World", "🌻 Dandy's World [ALPHA]")).toBe(1)
  })

  it('treats a Roblox genre suffix as noise', () => {
    expect(scoreCandidate('Greenville', 'Greenville RP')).toBeGreaterThanOrEqual(ACCEPT_THRESHOLD)
  })

  it('accepts a title that is the full name plus a tagline', () => {
    expect(
      scoreCandidate('Creatures of Sonaria', '✨ Creatures of Sonaria 📜 Survive Kaiju Animals'),
    ).toBeGreaterThanOrEqual(ACCEPT_THRESHOLD)
  })

  it('does NOT let the prefix rule match a one-word name', () => {
    // "Abyss" must not match "Abyss Legends Tycoon" — a single shared word
    // is far too weak a signal to auto-fill on.
    expect(scoreCandidate('Abyss', 'Abyss Legends Tycoon')).toBeLessThan(ACCEPT_THRESHOLD)
  })

  it('does NOT let the prefix rule match a numbered sequel', () => {
    // The wanted title must be a prefix of the candidate, not the reverse,
    // and "Steal a Brainrot 2" adds a token that changes the identity.
    expect(scoreCandidate('Steal a Brainrot 2', 'Steal a Brainrot')).toBeLessThan(ACCEPT_THRESHOLD)
    // ...and a trailing number in the EXTRA tokens means a sequel/knock-off.
    expect(scoreCandidate('Steal a Brainrot', 'Steal a Brainrot 2')).toBeLessThan(ACCEPT_THRESHOLD)
  })

  it('does NOT let a short name match a much longer unrelated title', () => {
    expect(
      scoreCandidate('Pets Go', 'Pets Go Ultimate Legends Simulator Tycoon Adventure RNG'),
    ).toBeLessThan(ACCEPT_THRESHOLD)
  })
})

describe('decideMatch', () => {
  it('matches a clear winner', () => {
    const d = decideMatch('Blox Fruits', [cand('Blox Fruits', 42), cand('Pet Sim 99', 7)])
    expect(d.status).toBe('matched')
    expect(d.best?.id).toBe(42)
  })

  it('reports unmatched when nothing clears the bar', () => {
    expect(decideMatch('Blox Fruits', [cand('Jailbreak')]).status).toBe('unmatched')
  })

  it('reports unmatched for an empty candidate list', () => {
    expect(decideMatch('Blox Fruits', []).status).toBe('unmatched')
  })

  it('refuses to guess between two equally exact titles', () => {
    const d = decideMatch('Blox Fruits', [cand('Blox Fruits', 1), cand('BLOX FRUITS!', 2)])
    expect(d.status).toBe('ambiguous')
    expect(d.candidates).toHaveLength(2)
  })

  it('carries candidates on an unmatched result so the report can list them', () => {
    const d = decideMatch('Blox Fruits', [cand('Jailbreak'), cand('Murder Mystery 2')])
    expect(d.candidates?.length).toBeGreaterThan(0)
  })
})

describe('decideFill', () => {
  const base = { slug: 'blox-fruits', name: 'Blox Fruits' }

  it('fills a game with no icon', () => {
    expect(decideFill({ ...base, image_url: null })).toEqual({ fill: true, reason: 'empty' })
    expect(decideFill({ ...base, image_url: '   ' })).toEqual({ fill: true, reason: 'empty' })
  })

  it('is fill-only: never overwrites an existing icon by default', () => {
    const d = decideFill({ ...base, image_url: 'https://cdn/x.webp' })
    expect(d).toEqual({ fill: false, reason: 'has-icon' })
  })

  it('overwrites exactly the forced slug', () => {
    const game = { ...base, image_url: 'https://cdn/x.webp' }
    expect(decideFill(game, { forceSlug: 'blox-fruits' }).fill).toBe(true)
    expect(decideFill(game, { forceSlug: 'adopt-me' }).fill).toBe(false)
  })

  it('NEVER refreshes a manual icon', () => {
    const d = decideFill(
      {
        ...base,
        image_url: 'https://cdn/x.webp',
        image_source: 'manual',
        image_synced_at: '2020-01-01T00:00:00Z',
      },
      { refresh: true },
    )
    expect(d).toEqual({ fill: false, reason: 'manual' })
  })

  it('treats unknown provenance as manual', () => {
    // Pre-filler rows have no image_source. Human until proven otherwise.
    const d = decideFill(
      { ...base, image_url: 'https://cdn/x.webp', image_source: null },
      { refresh: true },
    )
    expect(d).toEqual({ fill: false, reason: 'manual' })
  })

  it('refreshes an automated icon past the cutoff', () => {
    const now = new Date('2026-09-17T00:00:00Z')
    const old = new Date(now.getTime() - (REFRESH_AFTER_DAYS + 1) * 86_400_000).toISOString()
    const d = decideFill(
      { ...base, image_url: 'https://cdn/x.webp', image_source: 'roblox', image_synced_at: old },
      { refresh: true, now },
    )
    expect(d).toEqual({ fill: true, reason: 'stale' })
  })

  it('leaves a fresh automated icon alone', () => {
    const now = new Date('2026-09-17T00:00:00Z')
    const recent = new Date(now.getTime() - 2 * 86_400_000).toISOString()
    const d = decideFill(
      { ...base, image_url: 'https://cdn/x.webp', image_source: 'roblox', image_synced_at: recent },
      { refresh: true, now },
    )
    expect(d).toEqual({ fill: false, reason: 'fresh' })
  })

  it('refreshes an automated icon with a missing or unparseable sync time', () => {
    const g = { ...base, image_url: 'https://cdn/x.webp', image_source: 'appstore' as const }
    expect(decideFill({ ...g, image_synced_at: null }, { refresh: true }).fill).toBe(true)
    expect(decideFill({ ...g, image_synced_at: 'not-a-date' }, { refresh: true }).fill).toBe(true)
  })
})

describe('AUTOMATED_SOURCES', () => {
  it('lists every non-manual source, so --refresh covers each', () => {
    expect([...AUTOMATED_SOURCES].sort()).toEqual(['appstore', 'roblox', 'steam', 'wikidata'])
  })

  it('never contains manual — an admin upload is not automated', () => {
    expect(AUTOMATED_SOURCES).not.toContain('manual')
  })
})

describe('iconObjectPath', () => {
  it('writes under the wizard games/ prefix with a truncated hash', () => {
    const p = iconObjectPath('blox-fruits', 'abcdef0123456789abcdef', 512)
    expect(p).toBe('games/blox-fruits-abcdef012345-512.webp')
  })

  it('gives each size its own object', () => {
    const paths = [512, 128, 64].map((s) => iconObjectPath('x', 'hash12345678', s as 512))
    expect(new Set(paths).size).toBe(3)
  })
})
