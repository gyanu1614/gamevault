/**
 * Copy for the "How To Get" section of a value-list item page, built ONLY
 * from the item's verified how_to_get entry (values_items.how_to_get) and its
 * published price. Pure, so it is unit-tested and the section, the visible
 * FAQ and the FAQPage schema all say the same thing.
 *
 * Honesty rules (owner, 2026-10-05):
 *   - "unknown" never reads as obtainable: no cost, no odds, no note, only the
 *     "couldn't confirm" line and the trade/buy line;
 *   - an unobtainable item's cost is labelled as the ORIGINAL cost;
 *   - the unbox maths uses stated odds only, labelled "On average"; a wiki
 *     estimate is shown as written and never turned into a number.
 */

import {
  formatAmount,
  formatCount,
  isCrafted,
  parseRecipe,
  unboxExpectation,
  type HowToGetStatus,
  type RecipePart,
  type UnboxExpectation,
  type ValueHowToGet,
} from '@/lib/values/how-to-get'

/** Wiki text is CC BY-SA; the credit goes next to the source link. */
export const WIKI_LICENSE = 'CC BY-SA 3.0'

export interface StatusMeta {
  label: string
  /** Tailwind background for the status dot — the only colour in the pill. */
  dot: string
}

export function howToGetStatusMeta(status: HowToGetStatus): StatusMeta {
  switch (status) {
    case 'obtainable':
      return { label: 'Obtainable Now', dot: 'bg-success' }
    case 'unobtainable':
      return { label: 'No Longer Obtainable', dot: 'bg-text-tertiary' }
    case 'seasonal':
      return { label: 'Returns Seasonally', dot: 'bg-info' }
    default:
      return { label: 'Unconfirmed', dot: 'bg-warning' }
  }
}

/** Method / Cost / Odds / Released, only the ones present (and allowed for the status). */
export function howToGetRows(h: ValueHowToGet): Array<{ label: string; value: string }> {
  const rows = [{ label: 'Method', value: h.method }]
  if (h.status === 'unknown') {
    if (h.released) rows.push({ label: 'Released', value: h.released })
    return rows
  }
  // A craftable item's cost IS its recipe, which the Craft It panel already
  // shows — don't print it twice.
  const recipeShown = h.status === 'obtainable' && isCrafted(h) && parseRecipe(h.costs) != null
  if (h.costs && !recipeShown) {
    rows.push({ label: h.status === 'unobtainable' ? 'Original Cost' : 'Cost', value: h.costs })
  }
  if (h.odds) rows.push({ label: 'Odds', value: h.odds })
  if (h.released) rows.push({ label: 'Released', value: h.released })
  return rows
}

/**
 * The short muted line under the rows. Never on an unconfirmed item (its note
 * is a research memo). On an unobtainable item the data's closing "trading or
 * buying is the only way now" is dropped: the panel next to it says exactly
 * that, so the page doesn't say it twice.
 */
export function howToGetNote(h: ValueHowToGet): string | null {
  if (h.status === 'unknown' || !h.note) return null
  if (h.status !== 'unobtainable') return h.note
  const note = h.note
    .replace(/;\s*trading or buying is the only way( to get it)? now\.$/i, '.')
    .replace(/\s*Trading or buying is the only way( to get it)? now\.$/, '')
    .trim()
  return note || null
}

export const TRADE_ONLY_LINE = 'Trading or buying is the only way to get it now.'
export const UNCONFIRMED_LINE = "We couldn't confirm whether this can still be obtained."
export const UNCONFIRMED_TRADE_LINE = 'Trading or buying is the sure way to get it now.'
export const SEASONAL_LINE = 'It comes back with its event. Until then, trading or buying is the way to get it.'

export interface UnboxCopy {
  /** "25,000,000 Coins" */
  headline: string
  /** "25,000 spins at 1,000 Coins each" */
  detail: string
  /** "or 2,500,000 Diamonds, or 25,000 Mystery Keys" */
  alternatives: string | null
}

export function unboxCopy(e: UnboxExpectation): UnboxCopy {
  const [first, ...rest] = e.totals
  return {
    headline: formatAmount(first.total, first.unit),
    detail: `${formatCount(e.spins)} ${e.spins === 1 ? 'spin' : 'spins'} at ${formatAmount(first.amount, first.unit)} each`,
    alternatives: rest.length ? `or ${rest.map((t) => formatAmount(t.total, t.unit)).join(', or ')}` : null,
  }
}

/** What the right-hand panel shows next to "Buy It". */
export type HowToGetPath =
  | { kind: 'unbox'; copy: UnboxCopy }
  | { kind: 'craft'; recipe: RecipePart[] }
  | { kind: 'buy' }
  | { kind: 'trade'; lines: string[] }

export function howToGetPath(h: ValueHowToGet): HowToGetPath {
  switch (h.status) {
    case 'unobtainable':
      return { kind: 'trade', lines: [TRADE_ONLY_LINE] }
    case 'unknown':
      return { kind: 'trade', lines: [UNCONFIRMED_LINE, UNCONFIRMED_TRADE_LINE] }
    case 'seasonal':
      return { kind: 'trade', lines: [SEASONAL_LINE] }
  }
  const e = unboxExpectation(h)
  if (e) return { kind: 'unbox', copy: unboxCopy(e) }
  if (isCrafted(h)) {
    const recipe = parseRecipe(h.costs)
    if (recipe) return { kind: 'craft', recipe }
  }
  return { kind: 'buy' }
}

export interface SourceGroup {
  /** "Murder Mystery 2 Wiki" */
  label: string
  /** "CC BY-SA 3.0" for a wiki. */
  license: string | null
  links: Array<{ title: string; href: string }>
}

const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase())

/** Sources grouped by site, in first-seen order: wiki pages by title, the Roblox API as one link. */
export function howToGetSources(h: ValueHowToGet): SourceGroup[] {
  const groups = new Map<string, SourceGroup>()
  for (const href of h.sources) {
    let url: URL
    try {
      url = new URL(href)
    } catch {
      continue
    }
    const fandom = url.hostname.match(/^([a-z0-9-]+)\.fandom\.com$/)
    let key: string
    let group: Omit<SourceGroup, 'links'>
    let title: string
    if (fandom) {
      key = url.hostname
      group = { label: `${titleCase(fandom[1])} Wiki`, license: WIKI_LICENSE }
      const page = url.pathname.replace(/^\/wiki\//, '')
      title = decodeURIComponent(page).replace(/_/g, ' ') || group.label
    } else if (/(^|\.)roblox\.com$/.test(url.hostname)) {
      key = 'roblox'
      group = { label: 'Roblox', license: null }
      title = /game-passes/.test(url.pathname) ? 'Game Pass Listing' : 'Roblox'
    } else {
      key = url.hostname
      group = { label: url.hostname.replace(/^www\./, ''), license: null }
      title = url.hostname.replace(/^www\./, '')
    }
    const g = groups.get(key) ?? { ...group, links: [] }
    if (!g.links.some((l) => l.href === href)) g.links.push({ title, href })
    groups.set(key, g)
  }
  return [...groups.values()]
}

/** "Checked Oct 5, 2026" */
export function checkedLabel(h: ValueHowToGet): string {
  const d = new Date(`${h.checkedAt}T00:00:00Z`)
  return `Checked ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
}

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`)

/** The FAQ entry (visible FAQ + FAQPage schema): "How do you get X in MM2?" */
export function howToGetFaq(name: string, shortName: string, h: ValueHowToGet): { q: string; a: string } {
  const q = `How do you get ${name} in ${shortName}?`
  const method = sentence(h.method)
  switch (h.status) {
    case 'unobtainable':
      return { q, a: `${name} is no longer obtainable in ${shortName}. ${method} ${TRADE_ONLY_LINE}` }
    case 'unknown':
      return {
        q,
        a: `We couldn't confirm whether ${name} can still be obtained in ${shortName}. ${method} ${UNCONFIRMED_TRADE_LINE}`,
      }
    case 'seasonal':
      return { q, a: `${name} returns seasonally in ${shortName}. ${method} ${SEASONAL_LINE}` }
  }
  let a = `${name} can be obtained in ${shortName} now. ${method}`
  const e = unboxExpectation(h)
  if (e) {
    const u = unboxCopy(e)
    a += ` Each spin costs ${h.costs!.replace(/\s+per\s+spin$/i, '')}, and it drops at ${e.oddsPct}% per spin — about ${formatCount(e.spins)} spins (${u.headline}) on average.`
  } else if (h.costs) {
    a += ` It costs ${sentence(h.costs)}`
  }
  return { q, a: `${a} You can also trade for it or buy it from another player.` }
}
