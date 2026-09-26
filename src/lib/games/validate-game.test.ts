import { describe, it, expect } from 'vitest'
import {
  validateGameIdentity,
  RESERVED_GAME_SLUGS,
  GAME_ECOSYSTEMS,
} from './validate-game'

const base = {
  name: 'Old School RuneScape',
  slug: 'old-school-runescape',
  ecosystem: 'mmo',
  content_tier: 'listed',
  categories: ['currency', 'accounts', 'items'],
}

describe('validateGameIdentity', () => {
  it('accepts and normalises a well-formed row', () => {
    const r = validateGameIdentity(base)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.slug).toBe('old-school-runescape')
    expect(r.value.content_tier).toBe('listed')
    expect(r.value.categories).toEqual(['currency', 'accounts', 'items'])
  })

  it('lowercases and trims the slug', () => {
    const r = validateGameIdentity({ ...base, slug: '  Old-School-RuneScape  ' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.slug).toBe('old-school-runescape')
  })

  it('defaults content_tier to listed', () => {
    const r = validateGameIdentity({ ...base, content_tier: null })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.content_tier).toBe('listed')
  })

  it('deduplicates categories', () => {
    const r = validateGameIdentity({ ...base, categories: ['items', 'items', 'accounts'] })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.categories).toEqual(['items', 'accounts'])
  })

  it('rejects a short name', () => {
    const r = validateGameIdentity({ ...base, name: 'A' })
    expect(r.ok).toBe(false)
  })

  it.each(['Bad Slug', 'slug_with_underscore', 'slug.with.dot', 'ünicode'])(
    'rejects malformed slug %s',
    (slug) => {
      expect(validateGameIdentity({ ...base, slug }).ok).toBe(false)
    },
  )

  it('rejects leading/trailing dashes', () => {
    expect(validateGameIdentity({ ...base, slug: '-lead' }).ok).toBe(false)
    expect(validateGameIdentity({ ...base, slug: 'trail-' }).ok).toBe(false)
  })

  it('rejects slugs that shadow a top-level route', () => {
    for (const slug of ['blog', 'browse', 'cart', 'buy', 'fees', 'safedrop']) {
      const r = validateGameIdentity({ ...base, slug })
      expect(r.ok, slug).toBe(false)
      if (!r.ok) expect(r.error).toContain('reserved route')
    }
  })

  it('keeps every reserved slug a single path segment', () => {
    for (const s of RESERVED_GAME_SLUGS) expect(s).not.toContain('/')
  })

  it('accepts every ecosystem the CHECK constraint allows', () => {
    for (const eco of GAME_ECOSYSTEMS) {
      expect(validateGameIdentity({ ...base, ecosystem: eco }).ok, eco).toBe(true)
    }
  })

  it('rejects an ecosystem outside the CHECK constraint', () => {
    // `cross` is in the step-1 spec but NOT in the games_ecosystem_check
    // constraint — it must map to `other` upstream, never reach the DB.
    expect(validateGameIdentity({ ...base, ecosystem: 'cross' }).ok).toBe(false)
  })

  it('allows a null/empty ecosystem', () => {
    const r = validateGameIdentity({ ...base, ecosystem: '' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.ecosystem).toBeNull()
  })

  it('rejects an unknown content tier', () => {
    expect(validateGameIdentity({ ...base, content_tier: 'premium' }).ok).toBe(false)
  })

  it('rejects an unknown category', () => {
    expect(validateGameIdentity({ ...base, categories: ['skins'] }).ok).toBe(false)
  })

  it('rejects a game with no categories', () => {
    const r = validateGameIdentity({ ...base, categories: [] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('At least one category')
  })
})
