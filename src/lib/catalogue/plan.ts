/**
 * The catalogue run's decisions, pure: which wiki pages to read, which parsed
 * pages are items we already hold (adopt: record the page, insert nothing),
 * which are new, and when a run must stop and ask instead of writing.
 */
import { comparableName } from '../values/normalisers/eldorado-structured'
import type { CatalogueRef, KnownItem, ListedPage, ParsedItem, RecentPage } from './types'

/** Recent-changes window: covers two missed daily runs. */
export const RECENT_WINDOW_DAYS = 3
/**
 * A game's FIRST run (no refs yet) looks back this far, so pages created
 * before the job existed but not yet in a listing (MM2's uncategorised
 * Halloween 2026 pages) are still read once.
 */
export const BOOTSTRAP_WINDOW_DAYS = 30
/** An ignored page is looked at again after this long even without an edit. */
export const RECHECK_IGNORED_DAYS = 30
export const DEFAULT_INSERT_CAP = 50

/** "Traveler's Gun" → "travelers-gun"; the slug style every values table uses. */
export const slugifyTitle = (title: string) => comparableName(title).replace(/ /g, '-')
const nameKey = (name: string) => comparableName(name).replace(/ /g, '')

/**
 * Pages to read this run: every listed or recently changed page we never
 * decided about, plus ignored pages edited in the window (a stub can gain its
 * infobox) or unchecked for 30 days. Pages matched to an item are never re-read.
 */
export function candidatePages(input: {
  listed: ListedPage[]
  recent: RecentPage[]
  refs: Map<number, CatalogueRef>
  now: Date
}): ListedPage[] {
  const all = new Map<number, string>()
  for (const p of input.listed) all.set(p.pageId, p.title)
  for (const p of input.recent) if (!all.has(p.pageId)) all.set(p.pageId, p.title)
  const edited = new Set(input.recent.map((p) => p.pageId))
  const stale = input.now.getTime() - RECHECK_IGNORED_DAYS * 86_400_000
  const out: ListedPage[] = []
  for (const [pageId, title] of all) {
    const ref = input.refs.get(pageId)
    if (!ref) out.push({ pageId, title })
    else if (ref.status === 'ignored' && (edited.has(pageId) || Date.parse(ref.checkedAt) < stale)) out.push({ pageId, title })
  }
  return out.sort((a, b) => a.pageId - b.pageId)
}

export interface ParsedPage {
  pageId: number
  title: string
  item: ParsedItem | null
}

export interface CataloguePlan {
  adopt: { pageId: number; title: string; slug: string }[]
  insert: ParsedItem[]
  ignore: { pageId: number; title: string }[]
}

/** Known items match by wiki page id, then slug, then normalised name. */
export function planCatalogue(pages: ParsedPage[], known: KnownItem[]): CataloguePlan {
  const byPage = new Map<number, KnownItem>()
  const bySlug = new Map<string, KnownItem>()
  const byName = new Map<string, KnownItem>()
  for (const k of known) {
    if (k.pageId != null) byPage.set(k.pageId, k)
    bySlug.set(k.slug, k)
    byName.set(nameKey(k.name), k)
  }
  const plan: CataloguePlan = { adopt: [], insert: [], ignore: [] }
  const taken = new Set<string>()
  for (const p of pages) {
    if (!p.item) {
      plan.ignore.push({ pageId: p.pageId, title: p.title })
      continue
    }
    const hit = byPage.get(p.pageId) ?? bySlug.get(p.item.slug) ?? byName.get(nameKey(p.item.name))
    if (hit) plan.adopt.push({ pageId: p.pageId, title: p.title, slug: hit.slug })
    else if (taken.has(p.item.slug)) plan.ignore.push({ pageId: p.pageId, title: p.title })
    else {
      taken.add(p.item.slug)
      plan.insert.push(p.item)
    }
  }
  return plan
}

export type Verdict = { ok: true } | { ok: false; reason: string }

export function guardRun(input: { candidates: number; parseErrors: number; toInsert: number; cap: number; allowLarge: boolean }): Verdict {
  if (input.parseErrors >= 3 && input.parseErrors > input.candidates * 0.2) {
    return { ok: false, reason: `${input.parseErrors} of ${input.candidates} wiki pages failed to parse, so the wiki's page format may have changed` }
  }
  if (input.toInsert > input.cap && !input.allowLarge) {
    return { ok: false, reason: `${input.toInsert} new items is over the safety cap of ${input.cap}; check a dry run, then run once by hand with --allow-large` }
  }
  return { ok: true }
}
