/**
 * Every page of a game draws that game's ONE hero background through
 * GameHeroBackdrop — and nothing else paints a per-game or shared backdrop on
 * those pages.
 *
 * Why (owner, 2026-10-05): each values page had its own background (Adopt Me
 * characters, SAB's forest), the category pages a shared hooded-figure scene,
 * and a game with no file silently borrowed Steal a Brainrot's art. Now one
 * image per game, uploaded in admin, shared by the marketplace pages and the
 * hub pages, with the homepage hero's recipe. A new page under
 * /[gameSlug] that forgets the backdrop — or brings back a private one —
 * fails here.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const ROOT = process.cwd()
const GAME_ROUTES = join(ROOT, 'src/app/(marketplace)/[gameSlug]')
const read = (p: string) => readFileSync(p, 'utf8')
const rel = (p: string) => relative(ROOT, p)

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

/** Local modules a file imports ('./x', '../x'), resolved to files. */
function localImports(file: string): string[] {
  const src = read(file)
  const out: string[] = []
  for (const m of src.matchAll(/from '(\.{1,2}\/[^']+)'/g)) {
    const base = resolve(dirname(file), m[1])
    for (const cand of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx')]) {
      if (existsSync(cand) && statSync(cand).isFile()) {
        out.push(cand)
        break
      }
    }
  }
  return out
}

const RENDERS = /<GameHeroBackdrop\b/
const pages = walk(GAME_ROUTES).filter((f) => /\/page\.tsx$/.test(f))

/**
 * The modules that render each surface (pages, or the module a page hands
 * the whole render to). Each must draw the backdrop itself.
 */
const RENDER_MODULES = [
  'page.tsx', // game landing (hub + SAB landing branches)
  '[categorySlug]/page.tsx', // items, currency, bundles, accounts, boosting, generic
  '[categorySlug]/[listingSlug]/page.tsx',
  '[categorySlug]/item/_itemRoute.tsx', // item + item/variant pages
  'values/page.tsx',
  'values/_AdoptMeValuesPage.tsx',
  'values/[itemSlug]/page.tsx',
  'values/[itemSlug]/_AdoptMePetPage.tsx',
  'values/methodology/page.tsx',
  'values/methodology/_AdoptMeMethodology.tsx',
  'values/_generic/ValueListPage.tsx', // value-list hubs (MM2)
  'values/_generic/ValueListItemPage.tsx',
  'values/_generic/ValueListMethodology.tsx',
  'calculator/page.tsx',
  'calculator/_AdoptMeCalculatorPage.tsx',
  'neon-calculator/page.tsx',
  'price-index/page.tsx',
  'blog/page.tsx',
  'blog/[slug]/page.tsx',
  'sell/page.tsx',
]

describe('game pages render GameHeroBackdrop', () => {
  it('found the game routes', () => {
    expect(pages.length).toBeGreaterThanOrEqual(14)
  })

  it.each(RENDER_MODULES)('%s draws the game hero', (m) => {
    const file = join(GAME_ROUTES, m)
    expect(existsSync(file), `${m} moved: update RENDER_MODULES`).toBe(true)
    expect(read(file)).toMatch(RENDERS)
  })

  it.each(pages.map((p) => [rel(p), p] as const))('%s renders it (itself or through its render module)', (_r, page) => {
    const candidates = [page, ...localImports(page)]
    const hit = candidates.some((f) => RENDERS.test(read(f)))
    expect(hit, `${rel(page)} renders no <GameHeroBackdrop>: wrap the page body in it`).toBe(true)
  })

  it('the backdrop always names its game (no hard-coded other game)', () => {
    for (const m of RENDER_MODULES) {
      const src = read(join(GAME_ROUTES, m))
      for (const tag of src.match(/<GameHeroBackdrop\b[^>]*>/g) ?? []) {
        expect(tag, `${m}: ${tag}`).toMatch(/gameSlug=\{(gameSlug|params\.gameSlug)\}|gameSlug="adopt-me"/)
        // Only the Adopt Me–only modules may hard-code their own game.
        if (/gameSlug="/.test(tag)) expect(m, `${m}: ${tag}`).toMatch(/_AdoptMe/)
      }
    }
  })
})

describe('no stray backdrops on game pages', () => {
  const files = walk(GAME_ROUTES)

  it('the retired per-surface backdrops are gone', () => {
    expect(existsSync(join(GAME_ROUTES, 'values/_SabHeroBackdrop.tsx'))).toBe(false)
    const offenders = files.filter((f) => /SabHeroBackdrop|@\/components\/hero-backdrop|assets\/heroes\/\$\{/.test(read(f)))
    expect(offenders.map(rel)).toEqual([])
  })

  it('the marketplace layout paints no shared backdrop under the game hero', () => {
    const layout = read(join(ROOT, 'src/app/(marketplace)/layout.tsx'))
    const code = layout.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/HeroBackdrop|hero-backdrop|marketplace\.avif/)
  })

  it('GameHeroBackdrop is cookie-free (pages stay static) and reads through the cached hero read', () => {
    const comp = read(join(ROOT, 'src/components/marketplace/GameHeroBackdrop.tsx'))
    const server = read(join(ROOT, 'src/lib/games/hero.server.ts'))
    for (const src of [comp, server]) {
      expect(src).not.toMatch(/@\/lib\/supabase\/server|next\/headers|searchParams/)
    }
    expect(comp).toMatch(/from '@\/lib\/games\/hero\.server'/)
    expect(server).toMatch(/unstable_cache/)
    expect(server).toMatch(/gameHeroTag\(slug\)/)
    expect(server).toMatch(/createAnonClient/)
  })

  it('no Next image optimizer for the hero (pre-sized files, plain <img>)', () => {
    const art = read(join(ROOT, 'src/components/marketplace/GameHeroArt.tsx'))
    expect(art).not.toMatch(/next\/image/)
    expect(art).toMatch(/fetchPriority="high"/)
    expect(art).toMatch(/decoding="async"/)
  })
})
