import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 2026-10-20 usage audit (4.6): Next 14.2's router.prefetch(href) with no kind
// is a FULL prefetch (app-router.js: `options?.kind ?? PrefetchKind.FULL`), so
// hovering or touching a link to a dynamic page rendered it on the server
// (e.g. /founding from the footer, order pages from Live Orders) even when
// nobody clicked. AUTO prefetches dynamic pages only down to the loading
// boundary; static pages still prefetch fully from the cache.
describe('intent prefetch', () => {
  it('asks for an AUTO prefetch, never the FULL default', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/navigation/IntentPrefetch.tsx'), 'utf8')
    expect(src).toMatch(/router\.prefetch\(href, \{ kind: 'auto' as PrefetchKind \}\)/)
  })
})
