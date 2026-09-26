/**
 * Step 1c · Fix 2 — the sitemap honours the admin index override.
 *
 * Step 1 verification (D13.4) found `seo_indexable=false` produced a hub whose
 * robots meta said `noindex` while the sitemap still advertised the URL — a
 * contradictory signal to Google. Both surfaces already imported
 * `lib/games/indexability`, and the shared function already handled the
 * override; the SITEMAP CALLER simply never passed the field, so the rule was
 * evaluated with "no opinion" on every game.
 *
 * The unit tests in `src/lib/games/indexability.test.ts` cover the function.
 * This file covers the caller — it runs the REAL `sitemap()` against the local
 * DB and flips `seo_indexable` on a real game, which is the only way to prove
 * the wiring (a mocked Supabase chain would re-assert the mock, not the query).
 *
 * Restores the game's original seo_indexable in afterAll — it mutates an
 * existing seeded row rather than creating one, so there is no fixture to leak,
 * but the original value is captured and written back regardless of outcome.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'

import { hasEnv, URL as SB_URL, SVC, assertGuardTargetAllowed } from './throwaway'

// The sitemap reads through the server client, which resolves cookies. Give it
// a request scope that works outside Next's request lifecycle.
vi.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [], get: () => undefined, set: () => {} }),
}))

// `server-only` is a build-time marker with no Node resolution; the modules the
// sitemap imports pull it in. Stub it so the real module graph can load.
vi.mock('server-only', () => ({}))

// `lib/supabase/server` wraps createClient in React.cache(), which only exists
// inside a render. Pass the factory through unchanged — per-call memoization is
// an optimization here, and these tests WANT a fresh read after each override
// flip rather than a cached client.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const svc = hasEnv
  ? createClient(SB_URL!, SVC!, { auth: { persistSession: false } })
  : null

/**
 * Both targets are chosen so the override CONTRADICTS the default rule —
 * otherwise a test passes whether or not the caller forwards the field.
 *
 *  - INCLUDED_BY_DEFAULT: `data`-tier, so the default rule puts its hub IN the
 *    sitemap. `seo_indexable=false` must pull it out.
 *  - EXCLUDED_BY_DEFAULT: `listed` with zero inventory, so the default rule
 *    keeps its hub OUT. `seo_indexable=true` must force it in.
 *
 * (The first draft of this file used the zero-inventory game for both
 * directions; its "false excludes the hub" case passed against the UNFIXED
 * sitemap, because the default already excluded that hub.)
 */
const INCLUDED_BY_DEFAULT = 'steal-a-brainrot'
const EXCLUDED_BY_DEFAULT = 'old-school-runescape'

type Target = { slug: string; id: string; original: boolean | null }
const targets = new Map<string, Target>()
let ready = false

async function sitemapPaths(): Promise<string[]> {
  // Import fresh each time: sitemap() is a server function reading live data,
  // and Next's module cache would otherwise hold the first render's result.
  vi.resetModules()
  const mod = await import('@/app/sitemap')
  const entries = await mod.default()
  return entries.map((e) => e.url.replace(/^https?:\/\/[^/]+/, ''))
}

async function sitemapUrls(): Promise<Set<string>> {
  return new Set(await sitemapPaths())
}

async function setOverride(slug: string, value: boolean | null) {
  const t = targets.get(slug)!
  const { error } = await svc!
    .from('games')
    .update({ seo_indexable: value })
    .eq('id', t.id)
  if (error) throw new Error(`${slug} seo_indexable=${value}: ${error.message}`)
}

describe.skipIf(!hasEnv)('Step 1c — sitemap honours seo_indexable (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(SB_URL, process.env)
    for (const slug of [INCLUDED_BY_DEFAULT, EXCLUDED_BY_DEFAULT]) {
      const { data } = await svc!
        .from('games')
        .select('id, seo_indexable')
        .eq('slug', slug)
        .maybeSingle()
      if (!data) return // catalogue not seeded on this stack — tests self-skip
      targets.set(slug, {
        slug,
        id: (data as any).id,
        original: (data as any).seo_indexable,
      })
    }
    ready = targets.size === 2
  }, 60_000)

  afterAll(async () => {
    for (const t of targets.values()) await setOverride(t.slug, t.original)
  }, 60_000)

  it('baseline: the default rule includes one hub and excludes the other', async () => {
    if (!ready) return
    await setOverride(INCLUDED_BY_DEFAULT, null)
    await setOverride(EXCLUDED_BY_DEFAULT, null)
    const urls = await sitemapUrls()
    // Establishes that each later assertion is a real flip, not a coincidence.
    expect(urls.has(`/${INCLUDED_BY_DEFAULT}`)).toBe(true)
    expect(urls.has(`/${EXCLUDED_BY_DEFAULT}`)).toBe(false)
    // Zero-inventory sell page still carries the SEO.
    expect(urls.has(`/${EXCLUDED_BY_DEFAULT}/sell`)).toBe(true)
  }, 120_000)

  it('pulls an otherwise-included hub OUT when forced to false', async () => {
    if (!ready) return
    await setOverride(INCLUDED_BY_DEFAULT, false)
    const urls = await sitemapUrls()
    expect(urls.has(`/${INCLUDED_BY_DEFAULT}`)).toBe(false)
  }, 120_000)

  it('drops the sell page too — the override is per-game, not per-surface', async () => {
    if (!ready) return
    await setOverride(INCLUDED_BY_DEFAULT, false)
    const urls = await sitemapUrls()
    expect(urls.has(`/${INCLUDED_BY_DEFAULT}/sell`)).toBe(false)
  }, 120_000)

  it('forces an otherwise-excluded zero-inventory hub IN when set to true', async () => {
    if (!ready) return
    await setOverride(EXCLUDED_BY_DEFAULT, true)
    const urls = await sitemapUrls()
    expect(urls.has(`/${EXCLUDED_BY_DEFAULT}`)).toBe(true)
  }, 120_000)

  it('emits every URL exactly once', async () => {
    if (!ready) return
    await setOverride(INCLUDED_BY_DEFAULT, null)
    await setOverride(EXCLUDED_BY_DEFAULT, null)
    const paths = await sitemapPaths()
    const seen = new Map<string, number>()
    for (const p of paths) seen.set(p, (seen.get(p) ?? 0) + 1)
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([p]) => p)
    // /steal-a-brainrot/sell and /adopt-me/sell were each emitted twice: once
    // from a hardcoded content-hub block and once from the rule-driven
    // sellPages. A duplicate is how the rule-bypassing entry announced itself.
    expect(dupes).toEqual([])
  }, 120_000)

  it('routes content-hub sell pages through the shared rule, not a hardcoded entry', async () => {
    if (!ready) return
    // steal-a-brainrot is a content-hub game whose /sell URL used to be
    // hardcoded; with the override off it must disappear like any other game's.
    await setOverride(INCLUDED_BY_DEFAULT, false)
    expect((await sitemapUrls()).has(`/${INCLUDED_BY_DEFAULT}/sell`)).toBe(false)
    await setOverride(INCLUDED_BY_DEFAULT, null)
    expect((await sitemapUrls()).has(`/${INCLUDED_BY_DEFAULT}/sell`)).toBe(true)
  }, 120_000)

  it('treats null as "no opinion" — the default rule decides again', async () => {
    if (!ready) return
    await setOverride(INCLUDED_BY_DEFAULT, null)
    await setOverride(EXCLUDED_BY_DEFAULT, null)
    const urls = await sitemapUrls()
    expect(urls.has(`/${INCLUDED_BY_DEFAULT}`)).toBe(true)
    expect(urls.has(`/${EXCLUDED_BY_DEFAULT}`)).toBe(false)
  }, 120_000)
})
