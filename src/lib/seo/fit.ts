import type { Metadata } from 'next'
import { BRAND, TITLE_TEMPLATE } from './title'

/**
 * Search-length rules for every public page (2026-10-07, Bing site scan:
 * 598 titles over 60 characters, 1,098 descriptions over 160).
 *
 * - Title ≤ 60 characters as shown, brand included. Bing flags > 70 and
 *   Google cuts at ~60, so 60 is the line for both.
 * - Description ≤ 155 characters. Bing flags > 160 and Google cuts at
 *   ~155–160.
 *
 * Every public `generateMetadata` / `metadata` export passes through
 * `seoMeta()`, so a template can never ship a title or description that is
 * cut off in a result. A guard (`seo-meta-fit.guard.test.ts`) enforces it.
 */
export const TITLE_MAX = 60
export const DESC_MAX = 155

const BRAND_SUFFIX = TITLE_TEMPLATE.replace('%s', '')
/** A description cut shorter than this reads as clipped; keep a later boundary instead. */
const DESC_MIN_KEEP = 100

/** Cut at the last word boundary that fits, ending with an ellipsis. */
function cutAtWord(text: string, max: number): string {
  const slice = text.slice(0, max - 1)
  const at = slice.lastIndexOf(' ')
  return `${(at > max * 0.6 ? slice.slice(0, at) : slice).replace(/[\s,;:—–-]+$/, '')}…`
}

/**
 * A title that fits, without the brand when the brand would push it over.
 * Order of what goes: the " | DropMarket" suffix, then a trailing " — …" or
 * " | …" segment, then a trailing "(…)", then words from the end.
 */
export function fitTitleText(base: string, max = TITLE_MAX): string {
  let t = base.replace(/\s+/g, ' ').trim()
  while (t.length > max) {
    const seg = t.match(/^(.*\S)\s+[—–|:-]\s+[^—–|:]+$/)
    if (seg && seg[1].length >= 20) {
      t = seg[1]
      continue
    }
    const paren = t.match(/^(.*\S)\s+\([^()]*\)$/)
    if (paren && paren[1].length >= 20) {
      t = paren[1]
      continue
    }
    return cutAtWord(t, max)
  }
  return t
}

/**
 * The page's `title` for Next metadata: a plain string when "<title> |
 * DropMarket" fits (the layout template adds the brand), else `{ absolute }`
 * with the brand dropped and the title fitted.
 */
export function fitTitle(title: Metadata['title']): Metadata['title'] {
  if (title == null) return title
  if (typeof title === 'string') {
    const t = title.replace(/\s+/g, ' ').trim()
    if (t.length + BRAND_SUFFIX.length <= TITLE_MAX) return t
    return { absolute: fitTitleText(t) }
  }
  if ('absolute' in title && typeof title.absolute === 'string') {
    return { ...title, absolute: fitTitleText(title.absolute) }
  }
  return title
}

/**
 * A description that fits: whole sentences when they reach a useful length,
 * else up to the last clause break (", " / " — " / "; "), else whole words
 * with an ellipsis.
 */
export function fitDescription(text: string | null | undefined, max = DESC_MAX): string | undefined {
  if (text == null) return undefined
  const d = text.replace(/\s+/g, ' ').trim()
  if (d.length <= max) return d
  const head = d.slice(0, max + 1)

  // A cut never lands inside brackets: "(4 pets for a Neon." reads broken.
  const balanced = (t: string) => (t.match(/\(/g)?.length ?? 0) === (t.match(/\)/g)?.length ?? 0)

  // Sentence ends: ". ", "? ", "! " (or the very end of the slice).
  let best = -1
  for (const m of head.matchAll(/[.!?](?=\s|$)/g)) {
    const end = m.index! + 1
    if (end <= max && balanced(d.slice(0, end))) best = end
  }
  if (best >= DESC_MIN_KEEP) return d.slice(0, best)

  // Clause breaks: keep the text before the break and close it with a full stop.
  let clause = -1
  for (const m of head.matchAll(/(,|;| —| –| -) /g)) {
    if (m.index! + 1 <= max && balanced(d.slice(0, m.index!))) clause = m.index!
  }
  if (clause >= DESC_MIN_KEEP) return `${d.slice(0, clause).replace(/[\s,;:—–-]+$/, '')}.`

  return cutAtWord(d, max)
}

/**
 * Fit a page's metadata to the search-length rules: title, description, and
 * the Open Graph / Twitter copies of both.
 */
export function seoMeta(meta: Metadata): Metadata {
  const out: Metadata = { ...meta }
  if (meta.title !== undefined) out.title = fitTitle(meta.title)
  if (typeof meta.description === 'string') out.description = fitDescription(meta.description)
  if (meta.openGraph) {
    const og = { ...meta.openGraph }
    if (typeof og.title === 'string') og.title = fitTitleText(og.title, 70)
    if (typeof og.description === 'string') og.description = fitDescription(og.description, 200)
    out.openGraph = og
  }
  if (meta.twitter) {
    const tw = { ...meta.twitter }
    if (typeof tw.title === 'string') tw.title = fitTitleText(tw.title, 70)
    if (typeof tw.description === 'string') tw.description = fitDescription(tw.description, 200)
    out.twitter = tw
  }
  return out
}

/** For tests and the crawl script: the title exactly as a search result shows it. */
export function shownTitle(title: Metadata['title']): string {
  if (title == null) return BRAND
  if (typeof title === 'string') return TITLE_TEMPLATE.replace('%s', title)
  if ('absolute' in title && typeof title.absolute === 'string') return title.absolute
  return BRAND
}
