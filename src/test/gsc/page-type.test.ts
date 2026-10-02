import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  GAME_HUB_SEGMENTS,
  classifyPageType,
} from '../../../scripts/lib/gsc/page-type'
import { RESERVED_GAME_SLUGS } from '../../lib/games/validate-game'
import { blockNetwork } from './no-network'

blockNetwork()

const SITE = 'https://dropmarket.gg'

describe('classifyPageType', () => {
  it.each([
    ['/', 'home'],
    ['/browse', 'static'],
    ['/safedrop', 'static'],
    ['/sell/fees', 'static'],
    ['/account/become-seller', 'static'],
    ['/terms', 'legal'],
    ['/safedrop-policy', 'legal'],
    ['/seller-agreement', 'legal'],
    ['/blog', 'blog_index'],
    ['/blog/how-to-sell-fast', 'blog_post'],
    ['/buy/steal-a-brainrot-accounts', 'buy_landing'],
    ['/adopt-me', 'game_hub'],
    ['/adopt-me/sell', 'game_sell'],
    ['/adopt-me/blog', 'game_blog_index'],
    ['/adopt-me/blog/neon-pets-guide', 'game_blog_post'],
    ['/adopt-me/values', 'values_hub'],
    ['/adopt-me/values/shadow-dragon', 'value_item'],
    ['/adopt-me/values/methodology', 'values_methodology'],
    ['/adopt-me/calculator', 'calculator'],
    ['/adopt-me/neon-calculator', 'calculator'],
    ['/adopt-me/price-index', 'price_index'],
    ['/adopt-me/buy-pets', 'game_category'],
    ['/adopt-me/buy-pets/shadow-dragon-neon', 'listing'],
  ])('%s → %s', (path, expected) => {
    expect(classifyPageType(`${SITE}${path}`)).toBe(expected)
  })

  it('accepts bare paths as well as absolute URLs', () => {
    expect(classifyPageType('/adopt-me/values')).toBe('values_hub')
  })

  it('ignores query strings, fragments and trailing slashes', () => {
    expect(classifyPageType(`${SITE}/adopt-me/values/?sort=price#top`)).toBe('values_hub')
    expect(classifyPageType(`${SITE}/?utm=x`)).toBe('home')
  })

  it('files anything deeper than the known shapes under "other"', () => {
    expect(classifyPageType(`${SITE}/adopt-me/buy-pets/x/y`)).toBe('other')
    expect(classifyPageType(`${SITE}/adopt-me/sell/extra`)).toBe('other')
    expect(classifyPageType('not a url at all %%%')).toBe('other')
  })

  it('classifies every reserved top-level slug as non-game', () => {
    for (const slug of RESERVED_GAME_SLUGS) {
      expect(classifyPageType(`/${slug}`)).not.toBe('game_hub')
    }
  })
})

// ── Drift guards ────────────────────────────────────────────────────────────
// The classifier leans on two facts about src/app. Fail here — with a message
// that says what to update — instead of silently mislabelling pages in a report.

const APP_DIR = join(__dirname, '../../app')

function walkPages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walkPages(full, out)
    else if (/^page\.(t|j)sx?$/.test(name) || /^route\.(t|j)s$/.test(name)) out.push(full)
  }
  return out
}

/** URL path of a route file: route groups `(x)` dropped, rest verbatim. */
function routePath(file: string): string[] {
  return relative(APP_DIR, join(file, '..'))
    .split('/')
    .filter((seg) => seg && !(seg.startsWith('(') && seg.endsWith(')')))
}

describe('classifier stays in sync with src/app', () => {
  it('every static top-level route folder is in RESERVED_GAME_SLUGS', () => {
    const firstSegments = new Set(
      walkPages(APP_DIR)
        .map((f) => routePath(f)[0])
        .filter((s): s is string => !!s && !s.startsWith('[') && !s.startsWith('_')),
    )
    const missing = [...firstSegments].filter((s) => !RESERVED_GAME_SLUGS.has(s))
    expect(
      missing,
      `top-level route(s) ${missing.join(', ')} would be classified as a game hub — add to RESERVED_GAME_SLUGS (src/lib/games/validate-game.ts)`,
    ).toEqual([])
  })

  it('GAME_HUB_SEGMENTS equals the static folders under /[gameSlug]', () => {
    const gameDir = join(APP_DIR, '(marketplace)', '[gameSlug]')
    const folders = readdirSync(gameDir)
      .filter((n) => statSync(join(gameDir, n)).isDirectory())
      .filter((n) => !n.startsWith('[') && !n.startsWith('_') && !n.startsWith('('))
      .sort()
    expect([...GAME_HUB_SEGMENTS].sort()).toEqual(folders)
  })
})
