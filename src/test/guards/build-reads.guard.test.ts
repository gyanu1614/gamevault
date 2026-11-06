/**
 * What a release reads from the database.
 *
 * Builds don't read Vercel's Data Cache: on 2026-11-05 three releases, the last
 * two 98 minutes apart, each made ~33,000 database reads (global_categories
 * 1,190 / 1,203 / 1,151 under a 24-hour cache). So what a release costs is the
 * pages it builds times the reads each makes. It built every game and category,
 * 659 pages in all, most of them empty. That rule dated from ~12 deploys a day;
 * releases are batched now. Pages with something to buy stay built; the rest
 * render on their first visit, like any other long-tail page.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const MARKET = 'src/app/(marketplace)/[gameSlug]'

function staticParams(file: string): string {
  const source = readFileSync(file, 'utf8')
  const body = source.match(/export\s+(?:async\s+)?function\s+generateStaticParams[\s\S]*?\n\}/)?.[0]
  expect(body, `${file} has generateStaticParams`).toBeTruthy()
  return body as string
}

describe('what a release builds', () => {
  it('category pages: only the pairs the sitemap lists', () => {
    expect(staticParams(`${MARKET}/[categorySlug]/page.tsx`)).toContain('getIndexableCategoryPairs()')
  })

  it('game pages: only the games the sitemap lists', () => {
    expect(staticParams(`${MARKET}/page.tsx`)).toContain('getIndexableGameSlugs()')
  })

  it('game share images: the same set, each one a full image render', () => {
    expect(staticParams(`${MARKET}/opengraph-image.tsx`)).toContain('getIndexableGameSlugs()')
  })

  it('an unbuilt page still renders on its first visit', () => {
    for (const file of [`${MARKET}/[categorySlug]/page.tsx`, `${MARKET}/page.tsx`]) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/dynamicParams\s*=\s*false/)
    }
  })
})

describe('reads every page repeats', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

  it('a global category slug is looked up once, however many games ask', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        urls.push(url)
        return json(url.includes('/global_categories') ? [{ id: 'gc-1' }] : [{ id: 'row' }])
      }),
    )
    const { getGameCategoryByPair } = await import('@/lib/actions/new-schema')
    await getGameCategoryByPair('game-a', 'once-only-slug')
    await getGameCategoryByPair('game-b', 'once-only-slug')
    expect(urls.filter((u) => u.includes('/global_categories'))).toHaveLength(1)
    expect(urls.filter((u) => u.includes('/game_categories'))).toHaveLength(2)
  })

  it('a category that does not exist yet is asked about again, so it appears once created', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input))
        return json([])
      }),
    )
    const { getGameCategoryByPair } = await import('@/lib/actions/new-schema')
    await getGameCategoryByPair('game-a', 'not-yet-created')
    await getGameCategoryByPair('game-a', 'not-yet-created')
    expect(urls.filter((u) => u.includes('/global_categories'))).toHaveLength(2)
  })

  it('a game id for event lists comes from one read per game, not one per item page', () => {
    const source = readFileSync('src/lib/values/events.ts', 'utf8')
    expect(source).toContain('createValueGameSharedReadClient')
  })
})
