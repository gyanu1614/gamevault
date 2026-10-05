/**
 * Every in-app link goes through AppLink (src/components/navigation/AppLink.ts).
 *
 * `next/link` prefetches every link that scrolls into view. Google followed all
 * of them: ~26% of its requests were `?_rsc=` prefetch files, ~100 links in the
 * footer alone. AppLink prefetches on hover / touch / focus instead. A file that
 * imports `next/link` directly silently brings viewport prefetching back.
 *
 * The allow-list is the set of files another bundle owns, each with its reason.
 * It must stay honest: an entry that no longer imports `next/link` fails here
 * so it gets deleted, and the owner of those files swaps the import
 * (`import Link from '@/components/navigation/AppLink'`, no other change).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const SRC = path.join(process.cwd(), 'src')
const REL = (f: string) => path.relative(process.cwd(), f).split(path.sep).join('/')

/** The one file allowed to wrap next/link. */
const WRAPPER = 'src/components/navigation/AppLink.ts'

const ALLOWED: { prefix: string; reason: string }[] = [
  {
    prefix: 'src/app/(marketplace)/[gameSlug]/[categorySlug]/',
    reason: 'Bundle 2 owns the listing category page, its filters/cards and the listing detail page',
  },
  { prefix: 'src/app/notifications/', reason: 'Bundle 2 owns alerts/notifications' },
  { prefix: 'src/app/(admin)/admin/notifications/', reason: 'Bundle 2 owns alerts/notifications' },
]

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) yield* sourceFiles(full)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) yield full
  }
}

// A VALUE import of next/link (a `import type` is fine: no runtime Link).
const VALUE_IMPORT = /^import\s+(?!type\b)[^;\n]*from\s+['"]next\/link['"]/m

const importers = [...sourceFiles(SRC)].map(REL).filter((f) => VALUE_IMPORT.test(readFileSync(path.join(process.cwd(), f), 'utf8')))
const allowedFor = (f: string) => ALLOWED.find((a) => f.startsWith(a.prefix))

describe('links prefetch on intent, not on scroll', () => {
  it('only AppLink and the allow-listed files import next/link', () => {
    const offenders = importers.filter((f) => f !== WRAPPER && !allowedFor(f))
    expect(
      offenders,
      `import Link from '@/components/navigation/AppLink' instead of 'next/link' in:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('AppLink is the wrapper that imports next/link', () => {
    expect(importers).toContain(WRAPPER)
  })

  it.each(ALLOWED.map((a) => [a.prefix, a] as const))('allow-list entry %s is still needed', (prefix, entry) => {
    const stillImporting = importers.filter((f) => f.startsWith(entry.prefix))
    expect(stillImporting.length, `${prefix} no longer imports next/link: delete this allow-list entry`).toBeGreaterThan(0)
  })
})
