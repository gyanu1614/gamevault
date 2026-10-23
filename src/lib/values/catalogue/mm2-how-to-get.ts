/**
 * A new MM2 item's How To Get, written from the wiki's STRUCTURED obtain data
 * (mm2-wiki.ts parseObtain + box odds/costs), so an item the daily catalogue
 * adds is never a page without one. The hand-checked entries in
 * scripts/values-seeds/murder-mystery-2.how-to-get.json stay the better
 * source; this is `confidence: 'medium'` and only says what the wiki states.
 *
 * Honesty: a source from the current year that the wiki marks unavailable is
 * "seasonal" (a live or just-ended event box reads as not purchasable), an
 * older one is "unobtainable" and reads in the past tense. Pure; relative
 * imports only (loaded by the tsx catalogue CLI).
 */
import type { StoredHowToGet } from '../../catalogue/types'
import type { Mm2CatalogueItem, ObtainCost, ObtainSource } from './mm2-wiki'

/** Pass methods worth naming ("Tier Reward in the …"); anything else is "Reward of the …". */
const NAMED_METHODS = /^(tier reward|battle pass|leaderboard|event shop|quest|reward)$/i

const money = (c: ObtainCost) => `${c.amount.toLocaleString('en-US')} ${c.currency}`

function status(s: ObtainSource, year: number): StoredHowToGet['status'] {
  if (s.still_obtainable) return 'obtainable'
  return s.year === year ? 'seasonal' : 'unobtainable'
}

/** "the Knife Box 2 (2019)"; no year when the name already says it. */
function named(s: ObtainSource): string {
  const year = s.year && !s.name.includes(String(s.year)) ? ` (${s.year})` : ''
  return `the ${s.name}${year}`
}

function sentence(s: ObtainSource, now: boolean): string {
  switch (s.kind) {
    case 'box':
      return `${now ? 'Unboxed' : 'Was unboxed'} from ${named(s)}.`
    case 'pass':
    case 'event':
      return s.method && NAMED_METHODS.test(s.method) ? `${s.method} in ${named(s)}.` : `Reward of ${named(s)}.`
    case 'gamepass':
      return `${now ? 'Comes' : 'Came'} with the ${s.name}${/gamepass/i.test(s.name) ? '' : ' gamepass'}.`
    case 'crafting':
      return /craft/i.test(s.name) || !s.name ? 'Crafted at the Crafting Station.' : `Crafted from ${s.name}.`
    case 'code':
      return `Redeemed from a code${s.name ? ` (${s.name})` : ''}.`
    case 'shop':
      return `${now ? 'Bought' : 'Was bought'} from the ${s.name}.`
    default:
      return `${s.name.replace(/[.\s]+$/, '')}.`
  }
}

export function mm2HowToGet(
  item: Pick<Mm2CatalogueItem, 'obtain' | 'releaseYear' | 'origin'>,
  pageUrl: string,
  checkedAt: string,
): StoredHowToGet | null {
  const sources = item.obtain.filter((o) => o.kind !== 'unobtainable' && o.name)
  if (!sources.length) return null
  const year = Number(checkedAt.slice(0, 4))
  const [first, ...rest] = sources
  const state = status(first, year)
  let method = sentence(first, state !== 'unobtainable')
  if (rest.length) {
    const more = rest.length > 2 ? `, plus ${rest.length - 2} more` : ''
    method += ` Also from ${rest.slice(0, 2).map((s) => (s.kind === 'code' ? s.name : `the ${s.name}`)).join(' and ')}${more}.`
  }
  const costs = [first.cost, ...(first.alt_costs ?? [])].filter((c): c is ObtainCost => c != null).map(money).join(' or ')
  const odds = first.odds_text ?? (first.odds_pct != null ? `${first.odds_pct}%` : null)
  const released = item.releaseYear ? `${item.releaseYear}${item.origin ? ` (${item.origin})` : ''}` : null
  return {
    status: state,
    method,
    ...(costs ? { costs } : {}),
    ...(odds ? { odds } : {}),
    ...(released ? { released } : {}),
    sources: [pageUrl],
    confidence: 'medium',
    checked_at: checkedAt,
  }
}
