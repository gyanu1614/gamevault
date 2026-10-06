/**
 * Every values-hub DATA read must be cached under the tags the publish step
 * revalidates (the rule: header of src/lib/values/revalidation.ts).
 *
 * Why (verified on prod 2026-10-05): Adopt Me pet pages kept old prices and
 * descriptions after a DB fix + `values-revalidate?full=1`. On Next 14 an
 * un-annotated server fetch on a static route is stored in the Data Cache with
 * the page's window (7 days on item pages) and NO tags. `createAnonClient()`
 * fetches are un-annotated, so `revalidateTag(...)` re-rendered the page and
 * the re-render was served the old query responses.
 *
 * So, in the values surfaces below:
 *   1. no direct `createAnonClient()` for values data — reads go through the
 *      tagged values clients (lib/values/read-client.ts); the allow-list names
 *      the non-values reads (games rows, listings) with a reason and a count;
 *   2. no private supabase-js client (src/lib/sab/priceCache.ts had one);
 *   3. item-page code never reads under the game LIST tag (`price:<game>`):
 *      an item page carrying it is rebuilt by every list refresh (T1) — the
 *      only exceptions are build-time param collection;
 *   4. the shared generic loader is called with the item's scope on item
 *      pages.
 * Pure source analysis — no DB, no Next runtime.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const HUB = 'src/app/(marketplace)/[gameSlug]'

/** Directories whose every source file is a values surface. */
const SCOPE_DIRS = [
  `${HUB}/values`,
  `${HUB}/calculator`,
  `${HUB}/neon-calculator`,
  `${HUB}/price-index`,
  `${HUB}/blog`,
  `${HUB}/events`, // events archive (values_events + live prices)
  `${HUB}/free-items`, // free items guide (live prices of the Godlies it names)
  `${HUB}/codes`, // codes page (live prices of the merch-code items)
  `${HUB}/chromas`, // Chroma hub (live Chroma + normal prices, events)
  `${HUB}/inventory`, // Inventory Worth (every priced item's live price)
  `${HUB}/boxes`, // Box Odds (live prices of every box item, events)
]

/** Single files outside those directories that read values data. */
const SCOPE_FILES = [
  'src/lib/sab/priceCache.ts',
  'src/lib/values/data.ts',
  'src/lib/values/events.ts',
  `${HUB}/page.tsx`, // the SAB landing's top-values carousel
]

/**
 * Files allowed to keep `createAnonClient()` — for NON-values reads only, at
 * exactly this many call sites (a new call fails the guard until reviewed).
 */
const ANON_ALLOWED: Record<string, { count: number; reason: string }> = {
  [`${HUB}/blog/page.tsx`]: {
    count: 1,
    reason: 'getGame: the games row (name, SEO copy) — not values data; its price count is tagged',
  },
  [`${HUB}/blog/[slug]/page.tsx`]: {
    count: 1,
    reason: 'getGame: the games row for the article — not values data',
  },
  [`${HUB}/page.tsx`]: {
    count: 4,
    reason:
      'games rows + marketplace listings (listing surfaces revalidate by their own tags, Step 7b); ' +
      'its one price read (getSabTopValues) is tagged',
  },
}

/** Item-page code: every read there is under the ITEM's tags. */
const ITEM_FILES = [
  `${HUB}/values/[itemSlug]/page.tsx`,
  `${HUB}/values/[itemSlug]/_adoptMePetData.ts`,
  `${HUB}/values/[itemSlug]/_AdoptMePetPage.tsx`,
  `${HUB}/values/_generic/ValueItemPage.tsx`,
  `${HUB}/values/_generic/ValueListItemPage.tsx`,
]

/** Functions in item-page code that may read under the list tag: build-time only. */
const LIST_READ_OK_IN = new Set(['generateStaticParams', 'getPublishablePetSlugs'])

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const scopeFiles = [...new Set([...SCOPE_DIRS.flatMap(walk), ...SCOPE_FILES])]
const read = (f: string) => readFileSync(f, 'utf8')
/** Source without comments, so prose that names a function never counts. */
const code = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

/** Name of the nearest enclosing `function name(` before `index`. */
function enclosingFunction(src: string, index: number): string | null {
  const re = /function\s+([A-Za-z0-9_]+)\s*[(<]/g
  let name: string | null = null
  for (let m = re.exec(src); m && m.index < index; m = re.exec(src)) name = m[1]
  return name
}

function callSites(src: string, callee: string): number[] {
  const out: number[] = []
  const re = new RegExp(`\\b${callee}\\s*\\(`, 'g')
  for (let m = re.exec(src); m; m = re.exec(src)) out.push(m.index)
  return out
}

describe('values data reads carry the publish tags', () => {
  it('scans the values surfaces (guards a vacuous pass)', () => {
    expect(scopeFiles.length).toBeGreaterThan(30)
    for (const f of [...SCOPE_FILES, ...ITEM_FILES, ...Object.keys(ANON_ALLOWED)]) {
      expect(existsSync(f), `${f} moved — update this guard`).toBe(true)
    }
    // The tagged path is actually used where the bug was found.
    expect(code(`${HUB}/values/[itemSlug]/_adoptMePetData.ts`)).toMatch(/createValueItemReadClient\('adopt-me', slug\)/)
  })

  it('no direct createAnonClient() for values data', () => {
    const offenders: string[] = []
    for (const f of scopeFiles) {
      const n = callSites(code(f), 'createAnonClient').length
      const allowed = ANON_ALLOWED[f]?.count ?? 0
      if (n !== allowed) {
        offenders.push(
          `${f}: ${n} createAnonClient() call(s), ${allowed} allowed — values data must use ` +
            'createValueItemReadClient / createValueListReadClient (lib/values/read-client.ts); ' +
            'a non-values read needs an ANON_ALLOWED entry with its reason',
        )
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('no private supabase-js client in a values surface', () => {
    const offenders = scopeFiles.filter((f) => /from ['"]@supabase\/supabase-js['"]/.test(code(f)))
    expect(offenders, `build values reads on lib/values/read-client.ts: ${offenders.join(', ')}`).toEqual([])
  })

  it('item-page code never reads under the game list tag (outside build-time params)', () => {
    const offenders: string[] = []
    for (const f of ITEM_FILES) {
      const src = code(f)
      for (const callee of ['createValueListReadClient', 'valueListReadTags', 'valueGamePriceTag']) {
        for (const at of callSites(src, callee)) {
          const fn = enclosingFunction(src, at)
          if (!fn || !LIST_READ_OK_IN.has(fn)) offenders.push(`${f}: ${callee}() in ${fn ?? '<module>'}`)
        }
      }
      // A list-scope reader allowed above must stay build-time only.
      for (const at of callSites(src, 'getPublishablePetSlugs')) {
        const fn = enclosingFunction(src, at)
        if (fn !== 'generateStaticParams' && fn !== 'getPublishablePetSlugs') {
          offenders.push(`${f}: getPublishablePetSlugs() in ${fn ?? '<module>'} (list-tagged; build-time only)`)
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('item pages call the shared generic loader with the item scope', () => {
    const offenders: string[] = []
    for (const f of ITEM_FILES) {
      const src = code(f)
      const re = /\bgetValueItems\s*\(([^)]*)\)/g
      for (let m = re.exec(src); m; m = re.exec(src)) {
        const fn = enclosingFunction(src, m.index)
        if (fn === 'generateStaticParams') continue
        if (!/itemSlug/.test(m[1])) offenders.push(`${f}: getValueItems(${m[1]}) in ${fn} — pass { itemSlug }`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
