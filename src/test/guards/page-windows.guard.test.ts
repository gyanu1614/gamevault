/**
 * Guard: public page windows match how their data changes (2026-10-20 usage
 * audit, A13).
 *
 * The value LIST pages are refreshed by the publish step on every price move
 * (/api/internal/values-revalidate: the price:<game> list tag plus these
 * paths), so their own window is only a backstop: a day. At an hour, every
 * visit more than an hour after the last render rebuilt the page and re-read
 * the whole catalogue. Sitemaps rebuild the whole sitemap input per section;
 * IndexNow announces new pages at once, so six hours is fresh enough.
 * Blog pages stay hourly: an admin edit has no on-demand refresh.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const HUB = 'src/app/(marketplace)/[gameSlug]'
const windowOf = (file: string): number => {
  const m = /export const revalidate = ([0-9_]+)/.exec(readFileSync(join(process.cwd(), file), 'utf8'))
  if (!m) throw new Error(`${file}: no revalidate`)
  return Number(m[1].replace(/_/g, ''))
}

describe('public page windows', () => {
  it.each([
    `${HUB}/values/page.tsx`,
    `${HUB}/values/rows.json/route.ts`,
    `${HUB}/calculator/page.tsx`,
    `${HUB}/neon-calculator/page.tsx`,
    `${HUB}/price-index/page.tsx`,
  ])('%s refreshes on publish, with a daily backstop', (file) => {
    expect(windowOf(file)).toBeGreaterThanOrEqual(86_400)
  })

  it.each(['src/app/sitemap.xml/route.ts', 'src/app/sitemaps/[file]/route.ts'])('%s rebuilds at most every six hours', (file) => {
    expect(windowOf(file)).toBeGreaterThanOrEqual(21_600)
  })
})
