/**
 * Every marketplace listing read on a cached public page must be cached under
 * the tags a listing mutation revalidates — or the mutation re-renders the
 * page and the re-render is served the OLD rows.
 *
 * Why (2026-10-05, the values bug of #144 on the listing surfaces): on Next 14
 * an un-annotated server fetch on a static route is stored in the Data Cache
 * with the page's window (24 h on the category pages and hubs) and NO tags.
 * supabase-js fetches are un-annotated, so `revalidateListingSurfaces`'s
 * `revalidateTag('listings:category:<id>')` re-rendered the category page
 * (it binds the tag) while every listings / stats query in that render was a
 * Data Cache hit. A path revalidate would purge those fetches (Next tags each
 * fetch with its page's implicit path tags), but the seam only revalidates
 * tags, and the nightly cron's route pattern lacked the `(marketplace)` group,
 * so it matched no page at all.
 *
 * Rules:
 *   1. In the listing surfaces below, every `.from('listings')` read runs on a
 *      listing read client (lib/listings/read-client.ts) — judged by the
 *      nearest client constructed before it. Exceptions are named with a
 *      reason and a count.
 *   2. A `revalidatePath(<route pattern>, 'page' | 'layout')` names a real
 *      file path, route group included: Next 14 tags a render with its FILE
 *      path (`/(marketplace)/[gameSlug]/[categorySlug]/page`), so a group-less
 *      pattern silently matches nothing.
 *
 * Per-surface state (2026-10-05):
 *   - /[game]/[category] (incl. currency + bundles): tagged per category.
 *   - /[game] hub + SAB landing: tagged with every category of the game.
 *   - /[game]/[category]/item/…, value pages: unstable_cache under category /
 *     item stock tags (lib/value-listings/stock-server) — already correct.
 *   - /[game]/[category]/[listing]: ISR since 2026-10-09; reads tagged with
 *     the listing's category (the cross-category lookups with listings:home).
 *     Its owner/admin preview (/listing-preview/[id]) is per request and out
 *     of scope.
 *   - /: Latest Listings + game cards tagged `listings:home`.
 *   - /shop/[slug]: 60 s window, private client; storefront writes revalidate
 *     its concrete path (purges its fetches). Not in scope here.
 * Pure source analysis — no DB, no Next runtime.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const MARKETPLACE = 'src/app/(marketplace)'

/** Directories whose server files are listing surfaces (or feed one). */
const SCOPE_DIRS = [MARKETPLACE, 'src/features/home']
/** Single files outside those directories that read listings for one. */
const SCOPE_FILES = ['src/lib/seo/page-stats.ts', 'src/app/page.tsx']

const TAGGED = new Set(['createCategoryListingsReadClient', 'createHomeListingsReadClient'])
const CONSTRUCTORS = [
  ...TAGGED,
  'createAnonClient',
  'createTaggedAnonClient',
  'createClient',
  'createServiceRoleClient',
  'createServiceClient',
]

/** Files allowed to read listings on another client, at exactly this many reads. */
const ALLOWED: Record<string, { count: number; reason: string }> = {
  [`${MARKETPLACE}/[gameSlug]/[categorySlug]/_itemResolver.ts`]: {
    count: 1,
    reason:
      'route gate for legacy 2-segment item URLs (301 to the canonical listing URL); ' +
      'refreshed by the page window and the nightly path revalidate, not by listing tags',
  },
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const read = (f: string) => readFileSync(f, 'utf8')
/** Source without comments, so prose that names a function never counts. */
const code = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

/** Browser code runs no server cache: 'use client' files and browser-client users. */
const isServerFile = (src: string) =>
  !/^\s*['"]use client['"]/.test(src) && !/from ['"]@\/lib\/supabase\/client['"]/.test(src)

const scopeFiles = [...new Set([...SCOPE_DIRS.flatMap(walk), ...SCOPE_FILES])].filter((f) =>
  isServerFile(read(f)),
)

/** The client constructed nearest before `index` (by call site). */
function nearestConstructor(src: string, index: number): string | null {
  const re = new RegExp(`\\b(${CONSTRUCTORS.join('|')})\\s*\\(`, 'g')
  let name: string | null = null
  for (let m = re.exec(src); m && m.index < index; m = re.exec(src)) name = m[1]
  return name
}

function listingReads(src: string): number[] {
  const out: number[] = []
  const re = /\.from\(\s*['"]listings['"]\s*\)/g
  for (let m = re.exec(src); m; m = re.exec(src)) out.push(m.index)
  return out
}

describe('listing data reads carry the mutation tags', () => {
  it('scans the listing surfaces (guards a vacuous pass)', () => {
    for (const f of [...SCOPE_FILES, ...Object.keys(ALLOWED)]) {
      expect(existsSync(f), `${f} moved — update this guard`).toBe(true)
    }
    const withReads = scopeFiles.filter((f) => listingReads(code(f)).length > 0)
    expect(withReads.length).toBeGreaterThanOrEqual(8)
    // The tagged path is used where the bug was found.
    expect(code(`${MARKETPLACE}/[gameSlug]/[categorySlug]/page.tsx`)).toMatch(
      /createCategoryListingsReadClient\(\[categoryId\]\)/,
    )
  })

  it('every listings read runs on a listing read client', () => {
    const offenders: string[] = []
    for (const f of scopeFiles) {
      const src = code(f)
      const untagged = listingReads(src).filter((at) => !TAGGED.has(nearestConstructor(src, at) ?? ''))
      const allowed = ALLOWED[f]?.count ?? 0
      if (untagged.length !== allowed) {
        offenders.push(
          `${f}: ${untagged.length} listings read(s) off a listing read client, ${allowed} allowed — ` +
            'use createCategoryListingsReadClient / createHomeListingsReadClient ' +
            '(lib/listings/read-client.ts); an exception needs an ALLOWED entry with its reason',
        )
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('every revalidatePath route pattern names a real page or layout file', () => {
    const offenders: string[] = []
    const re = /revalidatePath\(\s*(['"`])([^'"`]*\[[^'"`]*)\1\s*,\s*['"](page|layout)['"]\s*\)/g
    let patterns = 0
    for (const f of walk('src')) {
      const src = code(f)
      for (let m = re.exec(src); m; m = re.exec(src)) {
        if (m[2].includes('${')) continue // concrete path built from values
        patterns++
        const file = join('src/app', m[2], `${m[3]}.tsx`)
        if (!existsSync(file)) {
          offenders.push(
            `${f}: revalidatePath('${m[2]}', '${m[3]}') — no ${file}. Next 14 tags renders with the ` +
              'FILE path, so include the route group, e.g. /(marketplace)/[gameSlug]/[categorySlug]',
          )
        }
      }
    }
    expect(patterns, 'the nightly cron uses route patterns').toBeGreaterThanOrEqual(2)
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
