/**
 * Phase 1 · Step 3 (PR 1) — the content hub is one config-driven system.
 *
 * The hub routes (values, values/[itemSlug], calculator, price-index,
 * methodology, blog) used to hardcode `['steal-a-brainrot']` in
 * generateStaticParams and gate their bodies on `gameSlug !== 'steal-a-brainrot'`,
 * with an inline `if (gameSlug === 'adopt-me')` branch for the second game.
 * Adding a third game meant editing five route files; getting one wrong meant a
 * page that built but 404'd, or worse, a game rendering another game's copy.
 *
 * They now read the per-game content config in `lib/content/theme`. This guard
 * pins the CURRENT published matrix, so:
 *
 *  - adding a game cannot silently switch a page on for an existing game
 *    (the snapshot below changes, and the diff is the review),
 *  - removing a page from SAB/Adopt Me fails here before it reaches prod.
 *
 * Pure config, no DB: the matrix is a compile-time constant.
 */
import { describe, it, expect } from 'vitest'
import {
  CONTENT_HUB_GAME_SLUGS,
  contentHubSlugsFor,
  getGameContentTheme,
  hasHubPage,
} from '@/lib/content/theme'

describe('content hub config', () => {
  it('publishes exactly the games that have a hub today', () => {
    expect([...CONTENT_HUB_GAME_SLUGS].sort()).toEqual([
      'adopt-me',
      'steal-a-brainrot',
    ])
  })

  /**
   * The published page matrix, pinned. Steal a Brainrot is the only game with a
   * price-index; both have values/calculator/methodology/blog.
   */
  it('pins the per-game page matrix', () => {
    const matrix = Object.fromEntries(
      CONTENT_HUB_GAME_SLUGS.map((slug) => [
        slug,
        getGameContentTheme(slug).pages,
      ]),
    )
    expect(matrix).toEqual({
      'steal-a-brainrot': {
        values: true,
        calculator: true,
        priceIndex: true,
        methodology: true,
        blog: true,
      },
      'adopt-me': {
        values: true,
        calculator: true,
        priceIndex: false,
        methodology: true,
        blog: true,
      },
    })
  })

  it('resolves each route prerender set from the config', () => {
    // These are the exact sets the routes used to hardcode.
    expect(contentHubSlugsFor('priceIndex')).toEqual(['steal-a-brainrot'])
    expect([...contentHubSlugsFor('values')].sort()).toEqual([
      'adopt-me',
      'steal-a-brainrot',
    ])
    expect([...contentHubSlugsFor('calculator')].sort()).toEqual([
      'adopt-me',
      'steal-a-brainrot',
    ])
  })

  it('refuses hub pages for a game with no content config', () => {
    // The fallback theme publishes nothing, so an unthemed slug still
    // notFound()s exactly as the old `!== 'steal-a-brainrot'` gate did.
    expect(hasHubPage('some-unthemed-game', 'values')).toBe(false)
    expect(hasHubPage('some-unthemed-game', 'calculator')).toBe(false)
    expect(contentHubSlugsFor('values')).not.toContain('some-unthemed-game')
  })

  it('keeps nav tools in step with the enabled pages', () => {
    for (const slug of CONTENT_HUB_GAME_SLUGS) {
      const theme = getGameContentTheme(slug)
      for (const tool of theme.navTools) {
        // A nav tab that points at a page the game does not publish would be a
        // link straight to a 404.
        expect(hasHubPage(slug, tool)).toBe(true)
      }
    }
  })

  it('only offers footer money-tools to games that publish them', () => {
    for (const slug of CONTENT_HUB_GAME_SLUGS) {
      const theme = getGameContentTheme(slug)
      if (!theme.footerTools) continue
      expect(hasHubPage(slug, 'values')).toBe(true)
      expect(hasHubPage(slug, 'calculator')).toBe(true)
    }
    // Flagship-only today — turning this on elsewhere ADDS visible footer
    // links, so it must be a deliberate, reviewed change.
    expect(
      CONTENT_HUB_GAME_SLUGS.filter((s) => getGameContentTheme(s).footerTools),
    ).toEqual(['steal-a-brainrot'])
  })

  it('gives every hub game an item noun, so no shared copy says "Brainrot"', () => {
    for (const slug of CONTENT_HUB_GAME_SLUGS) {
      const theme = getGameContentTheme(slug)
      expect(theme.itemNoun.length).toBeGreaterThan(0)
      expect(theme.itemNounPlural.length).toBeGreaterThan(0)
      if (slug !== 'steal-a-brainrot') {
        expect(theme.itemNoun).not.toBe('Brainrot')
      }
    }
  })
})
