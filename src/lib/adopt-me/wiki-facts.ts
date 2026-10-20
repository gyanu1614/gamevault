/**
 * Adopt Me pet facts from the fan wiki (adoptme.fandom.com, CC BY-SA): the
 * Pets infobox price ("{{Bucks|750}} ([[Jungle Egg]])", "{{Robux|1,000}}
 * (Off-sale)"), the lead's release date and stated odds, and the categories
 * (Unavailable, "Halloween Event (2022)"), turned into the shared facts every
 * value page renders (src/lib/values/item-facts.ts).
 *
 * Pure and dependency-free: the collector (scripts/collect-adopt-me-wiki-facts.mjs)
 * loads it through tsx, so no `@/` imports and no TS-only runtime syntax.
 *
 * Honesty rules, same as MM2's How To Get:
 *   - a status we can't read is "unknown", never obtainable;
 *   - an unavailable pet reads in the past tense;
 *   - odds are only the wiki's stated ones for THIS pet ("18.5% chance of
 *     hatching a Brown Bear"), never the rarity-wide figure.
 */

import { plainText, templateBody, templateParams } from '../wiki/markup'

export type AdoptMeHowToGetStatus = 'obtainable' | 'unobtainable' | 'unknown' | 'seasonal'

export interface AdoptMeWikiFacts {
  slug: string
  /** YYYY-MM-DD from the lead ("released on December 20, 2019"). */
  released_at: string | null
  origin_type: 'egg' | 'event' | null
  /** "Jungle Egg", "Halloween Event (2022)". */
  origin_detail: string | null
  how_to_get: {
    status: AdoptMeHowToGetStatus
    method: string
    costs?: string
    odds?: string
    released?: string
    sources: string[]
    confidence: 'high' | 'medium' | 'low'
    checked_at: string
  } | null
}

export interface PetPrice {
  /** "750", "1,000". Null for a free pet. */
  amount: string | null
  /** "Bucks", "Robux", "Candy", "Cranky Coins". */
  currency: string | null
  /** The egg, box or shop in the brackets: "Jungle Egg", "Wolf Box". */
  source: string | null
  offSale: boolean
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** The infobox price: amount + currency template, and what the brackets name. */
export function parsePrice(raw: string | undefined): PetPrice | null {
  if (!raw?.trim()) return null
  const cur = raw.match(/^\s*\{\{\s*([A-Za-z][A-Za-z ']*?)\s*\|\s*([\d,]+)\s*\}\}/)
  const bracket = raw.match(/\(([^)]*)\)\s*$/)
  const inBrackets = bracket ? plainText(bracket[1]) : null
  const offSale = /off-?sale/i.test(inBrackets ?? '')
  const source = inBrackets && !offSale && !/^\d/.test(inBrackets) ? inBrackets : null
  if (cur) return { amount: cur[2], currency: cur[1].trim(), source, offSale }
  if (/^\s*free\b/i.test(raw)) return { amount: null, currency: null, source, offSale }
  return null
}

/** "released on December 20, 2019" → "2019-12-20". */
export function parseReleased(text: string): string | null {
  const m = plainText(text).match(/released on ([A-Z][a-z]+) (\d{1,2}), (\d{4})/)
  if (!m) return null
  const mo = MONTHS.indexOf(m[1].toLowerCase())
  if (mo < 0) return null
  const d = new Date(Date.UTC(Number(m[3]), mo, Number(m[2])))
  return d.getUTCDate() === Number(m[2]) ? d.toISOString().slice(0, 10) : null
}

/** This pet's own stated chance: "18.5% chance of hatching a Brown Bear" / "87.5% chance of obtaining this pet". */
export function parseOdds(text: string, name: string): string | null {
  const plain = plainText(text)
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const own = new RegExp(`(\\d+(?:\\.\\d+)?)% chance of (?:hatching|obtaining|getting|receiving) (?:(?:a|an|the) )?(?:${esc}|this pet)\\b`, 'i')
  const m = plain.match(own)
  return m ? `${m[1]}%` : null
}

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** The event a pet came from, by its dated category: "Category:Halloween Event (2022)" → "Halloween Event (2022)". */
function eventOf(categories: string[]): string | null {
  const c = categories.map((x) => x.replace(/^Category:/, '')).find((x) => /\(\d{4}\)$/.test(x))
  return c ?? null
}

/** Unavailable by category, an off-sale price, or the lead saying so; else the catalogue's own status. */
export function statusOf(input: { categories: string[]; price: PetPrice | null; text: string; dbObtainability: string | null }): AdoptMeHowToGetStatus {
  const cats = input.categories.map((c) => c.replace(/^Category:/, '').toLowerCase())
  const lead = plainText(input.text).slice(0, 600)
  if (cats.includes('unavailable') || cats.includes('unavailable pets') || input.price?.offSale) return 'unobtainable'
  if (/\b(no longer (?:available|obtainable|sold)|now only (?:be )?obtainable|can only be obtained (?:by hatching any remaining|through trading))/i.test(lead)) return 'unobtainable'
  if (input.dbObtainability === 'obtainable') return 'obtainable'
  if (input.dbObtainability === 'unobtainable') return 'unobtainable'
  return 'unknown'
}

export function buildAdoptMeFacts(input: {
  slug: string
  name: string
  pageUrl: string
  text: string
  categories: string[]
  dbObtainability: string | null
  checkedAt: string
}): AdoptMeWikiFacts {
  const info = templateParams(templateBody(input.text, 'Pets'))
  const price = parsePrice(info.price)
  const releasedAt = parseReleased(input.text)
  const event = eventOf(input.categories)
  const egg = price?.source && /\begg$/i.test(price.source) ? price.source : null
  const origin_type = egg ? 'egg' : event ? 'event' : null
  // The egg, else the dated event (more telling than its box), else the shop or box it came from.
  const origin_detail = egg ?? event ?? price?.source ?? null
  const base = { slug: input.slug, released_at: releasedAt, origin_type, origin_detail } as const

  if (!price) return { ...base, how_to_get: null }
  const status = statusOf({ categories: input.categories, price, text: input.text, dbObtainability: input.dbObtainability })
  const now = status !== 'unobtainable'
  const odds = parseOdds(input.text, input.name)
  const cost = price.amount && price.currency ? `${price.amount} ${price.currency}` : null
  let method: string
  let costs: string | undefined
  let statedOdds: string | undefined
  if (egg) {
    method = now ? `Hatched from the ${egg} in the Nursery.` : `Hatched from the ${egg}, which is no longer sold.`
    if (cost) costs = `${cost} per hatch`
    if (odds) statedOdds = `${odds} per hatch`
  } else if (price.source) {
    method = `${now ? 'Comes' : 'Came'} from the ${price.source}${odds ? ` (${odds} chance)` : ''}${!cost ? ', for free' : ''}.`
    if (cost) costs = `${cost} per ${price.source}`
  } else if (cost) {
    method = `${now ? 'Sold' : 'Was sold'} for ${cost}${event ? ` during the ${event}` : ''}.`
    costs = cost
  } else {
    return { ...base, how_to_get: null }
  }

  return {
    ...base,
    how_to_get: {
      status,
      method,
      ...(costs ? { costs } : {}),
      ...(statedOdds ? { odds: statedOdds } : {}),
      ...(releasedAt ? { released: dateLabel(releasedAt) } : {}),
      sources: [input.pageUrl],
      confidence: 'medium',
      checked_at: input.checkedAt,
    },
  }
}
